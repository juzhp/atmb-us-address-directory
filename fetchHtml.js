const fs = require('node:fs/promises');
const path = require('node:path');
const axios = require('axios');
const cheerio = require('cheerio');

const DEFAULT_HEADERS = Object.freeze({
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
});

function ensureHtmlExtension(fileName) {
  return /\.html?$/i.test(fileName) ? fileName : `${fileName}.html`;
}

function sanitizeFileName(value) {
  const safeName = String(value)
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

  return ensureHtmlExtension(safeName || 'index');
}

function createResultFileName(rawUrl) {
  const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);
  const rawName = [url.hostname, url.port, url.pathname, url.search].filter(Boolean).join('-');

  return sanitizeFileName(rawName);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function textWithBreaks($, element) {
  const item = $(element).clone();

  item.find('br').replaceWith(' ');

  return normalizeText(item.text());
}

function ownText($, element) {
  return normalizeText(
    $(element)
      .contents()
      .filter((_, node) => node.type === 'text')
      .text(),
  );
}

function cleanMailboxUnitText(value) {
  return normalizeText(
    String(value || '')
      .replace(/\bunit\s*#?\s*mailbox\b/gi, ' ')
      .replace(/#\s*mailbox\b/gi, ' ')
      .replace(/\bmailbox\b/gi, ' ')
      .replace(/\bunit\b/gi, ' ')
      .replace(/[-#]/g, ' '),
  );
}

function dropLeadingAddressLabel(rows) {
  if (rows.length < 2) {
    return rows;
  }

  const [first, second] = rows;
  if (!first || !second) {
    return rows;
  }

  const firstLooksLikeLabel = /\s-\s/.test(first.text) || !/^\d/.test(first.text);
  const secondLooksLikeStreet = /^\d/.test(second.text);

  return firstLooksLikeLabel && secondLooksLikeStreet ? rows.slice(1) : rows;
}

function isMailboxPlaceholderRow($, element) {
  if (!element) return false;

  const item = $(element);

  return item.find('.t-placeholder').length > 0 && /MAILBOX/i.test(item.text());
}

function parseCityStateZip(value) {
  const text = normalizeText(value);
  const match = text.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  return {
    city: match ? match[1] : '',
    state: match ? match[2] : '',
    zip: match ? match[3] : '',
  };
}

function isStateUrl(url) {
  const parts = url.pathname.split('/').filter(Boolean);

  return parts.length === 3 && parts[0] === 'l' && parts[1] === 'usa';
}

function parseCountText(text) {
  const value = normalizeText(text);

  return /^\d+$/.test(value) ? Number(value) : null;
}

function getCountInsideLink($, item) {
  let count = null;

  item.find('*').each((__, child) => {
    const currentCount = parseCountText($(child).text());
    if (count === null && currentCount !== null) {
      count = currentCount;
      $(child).remove();
    }
  });

  return count;
}

function getCountBesideLink($, element) {
  let sibling = $(element).next();

  while (sibling.length) {
    if (sibling[0].tagName && sibling[0].tagName.toLowerCase() === 'br') {
      return null;
    }

    const count = parseCountText(sibling.text());
    if (count !== null) {
      return count;
    }

    sibling = sibling.next();
  }

  return null;
}

function parseStateList(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const states = [];
  const locationListLinks = $('.loc-list-container a[href]');
  const hasLocationList = locationListLinks.length > 0;
  const links = hasLocationList ? locationListLinks : $('a[href]');

  links.each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    const stateUrl = new URL(href, baseUrl);
    if ((!hasLocationList && !isStateUrl(stateUrl)) || seen.has(stateUrl.pathname)) return;

    const item = $(element).clone();
    let count = getCountInsideLink($, item);
    if (count === null) {
      count = getCountBesideLink($, element);
    }

    let name = normalizeText(item.text());
    if (count === null) {
      const trailingCount = name.match(/^(.*?)\s+(\d+)$/);
      if (trailingCount) {
        name = normalizeText(trailingCount[1]);
        count = Number(trailingCount[2]);
      }
    }

    if (!name) return;

    seen.add(stateUrl.pathname);
    states.push({
      name,
      url: stateUrl.toString(),
      count,
    });
  });

  return states;
}

function parseLocationList(html, baseUrl) {
  const $ = cheerio.load(html);
  const locations = [];

  $('.theme-location-item').each((_, element) => {
    const item = $(element);
    const name = normalizeText(item.find('.t-title').first().text());
    const address = textWithBreaks($, item.find('.t-addr').first());
    const price = normalizeText(item.find('.t-price b').first().text());
    const href = item.find('a.gt-plan[href], a[href]').first().attr('href');

    if (!name || !href) return;

    locations.push({
      name,
      address,
      price,
      url: new URL(href, baseUrl).toString(),
    });
  });

  return locations;
}

function getElementLink($, element, baseUrl) {
  const item = $(element);
  const href = item.attr('href');
  if (href) {
    return new URL(href, baseUrl).toString();
  }

  const onclick = item.attr('onclick') || '';
  const match = onclick.match(/location\.href\s*=\s*['"]?([^'";\s]+)/i);

  return match ? new URL(match[1], baseUrl).toString() : null;
}

function parseLocationDetail(html, baseUrl) {
  const $ = cheerio.load(html);
  const myearElement = $('#myear').first();
  const addressElements = $('.t-addr .t-text > div').toArray();
  const rows = addressElements
    .map((element) => ({
      text: normalizeText($(element).text()),
      ownText: ownText($, element),
    }))
    .filter((row) => row.text && !/^your name$/i.test(row.text));
  const cityStateZipIndex = rows.findIndex((row) => Boolean(parseCityStateZip(row.text).zip));
  const cityStateZip = cityStateZipIndex >= 0 ? rows[cityStateZipIndex]?.text ?? '' : '';
  const country = cityStateZipIndex >= 0
    ? normalizeText(rows[cityStateZipIndex + 1]?.text ?? '') || 'United States'
    : '';
  const addressRows = dropLeadingAddressLabel(cityStateZipIndex >= 0 ? rows.slice(0, cityStateZipIndex) : rows);
  const address = normalizeText(
    addressRows
      .map((row) => cleanMailboxUnitText(row.ownText || row.text))
      .filter(Boolean)
      .join(' '),
  );
  const parsedLocation = parseCityStateZip(cityStateZip);
  const detailAddress = normalizeText(
    [
      address,
      cityStateZip,
      country,
    ]
      .filter(Boolean)
      .join(' '),
  );

  return {
    myearUrl: myearElement.length ? getElementLink($, myearElement, baseUrl) : null,
    detailAddress,
    country,
    state: parsedLocation.state,
    city: parsedLocation.city,
    address,
    zip: parsedLocation.zip,
  };
}

function parseMailboxNumberRange(html) {
  const $ = cheerio.load(html);
  const mailboxNumbers = $('#f_boxid > option')
    .toArray()
    .map((element) => normalizeText($(element).text()))
    .filter(Boolean)
    .map((text) => {
      const match = text.match(/\d+/);

      return match ? Number(match[0]) : NaN;
    })
    .filter(Number.isFinite);

  return {
    mailboxNumbers,
    mailboxMin: mailboxNumbers.length ? Math.min(...mailboxNumbers) : null,
    mailboxMax: mailboxNumbers.length ? Math.max(...mailboxNumbers) : null,
  };
}

function collectSetCookies(cookieStore, setCookieHeader) {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  cookies.forEach((cookie) => {
    const pair = cookie.split(';')[0];
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) return;

    cookieStore.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
  });
}

function createCookieHeader(cookieStore) {
  return [...cookieStore.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function fetchWithRedirectCookies(targetUrl, axiosConfig = {}) {
  const maxRedirects = Number.isInteger(axiosConfig.maxRedirects) ? axiosConfig.maxRedirects : 5;
  const cookieStore = new Map();
  let currentUrl = new URL(targetUrl);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const cookieHeader = createCookieHeader(cookieStore);
    const headers = {
      ...DEFAULT_HEADERS,
      ...(axiosConfig.headers || {}),
    };

    if (cookieHeader) {
      headers.Cookie = headers.Cookie ? `${headers.Cookie}; ${cookieHeader}` : cookieHeader;
    }

    const response = await axios.get(currentUrl.toString(), {
      timeout: 15000,
      responseType: 'text',
      transformResponse: [(data) => data],
      ...axiosConfig,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      headers,
    });

    collectSetCookies(cookieStore, response.headers['set-cookie']);

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      currentUrl = new URL(response.headers.location, currentUrl);
      continue;
    }

    return {
      response,
      finalUrl: currentUrl.toString(),
    };
  }

  throw new Error(`Too many redirects while fetching ${targetUrl}`);
}

async function fetchHtmlToResultFolder(url, options = {}) {
  const targetUrl = new URL(url);
  const cwd = options.cwd || process.cwd();
  const outputDir = path.join(cwd, 'resultHtml');
  const axiosConfig = options.axiosConfig || {};
  const fetchResult = options.preserveRedirectCookies
    ? await fetchWithRedirectCookies(targetUrl, axiosConfig)
    : {
      response: await axios.get(targetUrl.toString(), {
        timeout: 15000,
        maxRedirects: 5,
        responseType: 'text',
        transformResponse: [(data) => data],
        ...axiosConfig,
        headers: {
          ...DEFAULT_HEADERS,
          ...(axiosConfig.headers || {}),
        },
      }),
      finalUrl: targetUrl.toString(),
    };
  const { response, finalUrl } = fetchResult;

  const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
  const fileName = options.filename ? sanitizeFileName(options.filename) : createResultFileName(targetUrl);
  const filePath = path.join(outputDir, fileName);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(filePath, html, 'utf8');

  return {
    url: targetUrl.toString(),
    finalUrl,
    filePath,
    html,
    status: response.status,
    contentType: response.headers['content-type'],
  };
}

async function fetchLocationDetails(locations, options = {}) {
  const detailedLocations = [];

  for (const location of locations) {
    const detailResult = await fetchHtmlToResultFolder(location.url, options);
    const detailData = parseLocationDetail(detailResult.html, location.url);
    let myearData = {};

    if (detailData.myearUrl) {
      const myearResult = await fetchHtmlToResultFolder(detailData.myearUrl, {
        ...options,
        preserveRedirectCookies: true,
        axiosConfig: {
          ...(options.axiosConfig || {}),
          headers: {
            ...((options.axiosConfig || {}).headers || {}),
            Referer: location.url,
          },
        },
      });

      myearData = {
        ...parseMailboxNumberRange(myearResult.html),
        myearFilePath: myearResult.filePath,
      };
    }

    detailedLocations.push({
      ...location,
      ...detailData,
      ...myearData,
      detailFilePath: detailResult.filePath,
    });
  }

  return detailedLocations;
}

async function fetchCountedStateLocations(startUrl, options = {}) {
  const indexResult = await fetchHtmlToResultFolder(startUrl, options);
  const states = parseStateList(indexResult.html, startUrl);
  const countedStates = states.filter((item) => typeof item.count === 'number' && item.count > 0);
  const targetStates = Number.isInteger(options.maxStates)
    ? countedStates.slice(0, Math.max(0, options.maxStates))
    : countedStates;
  const stateResults = [];

  for (const state of targetStates) {
    const stateResult = await fetchHtmlToResultFolder(state.url, options);
    const locations = parseLocationList(stateResult.html, state.url);

    stateResults.push({
      state,
      locations: options.includeLocationDetails ? await fetchLocationDetails(locations, options) : locations,
      stateFilePath: stateResult.filePath,
    });
  }

  return {
    states,
    stateResults,
    indexFilePath: indexResult.filePath,
  };
}

async function fetchFirstCountedStateLocations(startUrl, options = {}) {
  const result = await fetchCountedStateLocations(startUrl, {
    ...options,
    maxStates: 1,
  });
  const firstStateResult = result.stateResults[0];

  return {
    state: firstStateResult ? firstStateResult.state : null,
    locations: firstStateResult ? firstStateResult.locations : [],
    states: result.states,
    indexFilePath: result.indexFilePath,
    stateFilePath: firstStateResult ? firstStateResult.stateFilePath : null,
  };
}

module.exports = {
  createResultFileName,
  fetchCountedStateLocations,
  fetchFirstCountedStateLocations,
  fetchHtmlToResultFolder,
  parseLocationDetail,
  parseLocationList,
  parseMailboxNumberRange,
  parseStateList,
};
