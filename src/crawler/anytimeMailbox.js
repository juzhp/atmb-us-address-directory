import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as cheerio from "cheerio";
import got from "got";
import PQueue from "p-queue";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);
const client = got.extend({
  timeout: { request: config.requestTimeoutMs },
  retry: { limit: config.requestRetries },
  headers: {
    "user-agent": config.userAgent
  }
});

export async function crawlUsaLocations({ onProgress } = {}) {
  const usaHtml = await fetchHtml(config.usaUrl);
  const statePages = extractStatePages(usaHtml);
  const queue = new PQueue({ concurrency: config.concurrency });
  const seen = [];
  let discovered = 0;
  let processedStates = 0;
  let failed = 0;

  const tasks = statePages.map((statePage) =>
    queue.add(async () => {
      try {
        const html = await fetchHtml(statePage.url);
        const parsed = extractListingsFromStatePage(html, statePage);
        discovered += parsed.length;
        seen.push(...parsed);
      } catch (error) {
        failed += 1;
        onProgress?.({
          type: "state_error",
          state: statePage.stateCode,
          error: error.message
        });
      } finally {
        processedStates += 1;
        onProgress?.({
          type: "state_complete",
          processedStates,
          totalStates: statePages.length,
          discovered,
          failed
        });
      }
    })
  );

  await Promise.all(tasks);

  return {
    totalStates: statePages.length,
    totalFailedStates: failed,
    locations: dedupeLocations(seen)
  };
}

export async function scanLocationPersonalizeRange(detailUrl) {
  const detailHtml = await fetchHtml(detailUrl);
  const firstPlan = extractFirstPlanLink(detailHtml);

  if (!firstPlan) {
    return {
      firstPlanUrl: null,
      firstPlanTerm: null,
      firstPlanSrvplId: null,
      personalizeMin: null,
      personalizeMax: null,
      personalizeScannedAt: new Date().toISOString(),
      personalizeError: "First plan link not found."
    };
  }

  const signupHtml = await fetchSignupHtml(firstPlan.url);
  const personalizeRange = extractPersonalizeRange(signupHtml);

  return {
    firstPlanUrl: firstPlan.url,
    firstPlanTerm: firstPlan.term,
    firstPlanSrvplId: firstPlan.srvPlnId,
    personalizeMin: personalizeRange.min,
    personalizeMax: personalizeRange.max,
    personalizeScannedAt: new Date().toISOString(),
    personalizeError: personalizeRange.error
  };
}

async function fetchHtml(url) {
  return client.get(url).text();
}

async function fetchSignupHtml(url) {
  const html = await fetchHtml(url);
  if (html.includes('id="f_boxid"') || html.includes("Personalize Your Address")) {
    return html;
  }

  return fetchHtmlViaPowerShell(url);
}

async function fetchHtmlViaPowerShell(url) {
  const command = `
$response = Invoke-WebRequest -UseBasicParsing '${url.replace(/'/g, "''")}'
[Console]::Out.Write($response.Content)
`.trim();

  const { stdout } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-Command", command],
    {
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true
    }
  );

  return stdout;
}

function extractStatePages(html) {
  const $ = cheerio.load(html);
  const pages = new Map();

  $("a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href");
    if (!href) {
      return;
    }

    const absoluteUrl = new URL(href, config.baseUrl).toString();
    const match = absoluteUrl.match(/\/l\/usa\/([^/?#]+)/i);
    if (!match) {
      return;
    }

    const slug = match[1].toLowerCase();
    if (slug === "usa") {
      return;
    }

    const stateName = normalizeWhitespace($(anchor).text());
    if (!stateName || /\d/.test(stateName)) {
      return;
    }
    pages.set(absoluteUrl, {
      url: absoluteUrl,
      stateName,
      stateCode: stateCodeFromSlug(slug),
      slug
    });
  });

  return [...pages.values()];
}

function extractListingsFromStatePage(html, statePage) {
  const $ = cheerio.load(html);
  const cards = [];

  $(".theme-location-item").each((_, element) => {
    const card = $(element);
    const locationName = normalizeWhitespace(card.find(".t-title").first().text());
    const priceText = normalizeWhitespace(card.find(".t-price").first().text());
    const priceMatch = priceText.match(/US\$\s*([\d,.]+)\s*\/\s*(month|year)/i);

    const addrHtml = card.find(".t-addr").first().html() ?? "";
    const [streetLine, cityStateZipLine] = extractLinesFromHtml(addrHtml);
    const parsedAddress =
      streetLine && cityStateZipLine ? parseAddressLines(streetLine, cityStateZipLine) : null;

    if (!locationName || !priceMatch || !parsedAddress) {
      return;
    }

    const detailHref = card.find("a[href]").first().attr("href");
    const monthlyPrice = normalizePrice(
      Number(priceMatch[1].replace(/,/g, "")),
      priceMatch[2].toLowerCase()
    );
    const fullAddress = `${parsedAddress.street}, ${parsedAddress.city}, ${parsedAddress.state} ${parsedAddress.postalCode}`;
    const externalId = hashExternalId({
      state: parsedAddress.state,
      locationName,
      fullAddress
    });

    cards.push({
      externalId,
      locationName,
      fullAddress,
      street: parsedAddress.street,
      street2: null,
      city: parsedAddress.city,
      state: parsedAddress.state,
      postalCode: parsedAddress.postalCode,
      country: "US",
      monthlyPrice,
      currency: "USD",
      priceText,
      priceType: priceMatch[2].toLowerCase() === "year" ? "from_yearly" : "from",
      detailUrl: detailHref ? new URL(detailHref, config.baseUrl).toString() : null,
      sourceUrl: statePage.url,
      services: [],
      rdi: null,
      cmra: null,
      raw: {
        locationName,
        priceText,
        streetLine,
        cityStateZipLine,
        detailHref,
        statePage
      }
    });
  });

  if (cards.length > 0) {
    return dedupeLocations(cards);
  }

  return extractListingsFromStatePageFallback(html, statePage);
}

function parseAddressLines(streetLine, cityStateZipLine) {
  const street = normalizeWhitespace(streetLine);
  const normalized = normalizeWhitespace(cityStateZipLine);
  const match = normalized.match(/^(?<city>[A-Za-z .'-]+),\s*(?<state>[A-Z]{2})\s+(?<postalCode>\d{5}(?:-\d{4})?)$/);
  if (!match?.groups) {
    return null;
  }

  return {
    street,
    city: normalizeWhitespace(match.groups.city),
    state: match.groups.state.toUpperCase(),
    postalCode: match.groups.postalCode
  };
}

function extractServices(lines) {
  const known = [
    "Open & Scan",
    "Forward",
    "Check Deposit",
    "Shred",
    "Recycle",
    "Local Pickup"
  ];

  return known.filter((service) =>
    lines.some((line) => line.toLowerCase().includes(service.toLowerCase()))
  );
}

function normalizeWhitespace(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function extractLinesFromHtml(html) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(decodeHtmlEntities(line)))
    .filter(Boolean);
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizePrice(value, period) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (period === "year") {
    return Number((value / 12).toFixed(2));
  }

  return value;
}

function stateCodeFromSlug(slug) {
  const map = {
    alabama: "AL",
    alaska: "AK",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    dc: "DC",
    delaware: "DE",
    florida: "FL",
    georgia: "GA",
    hawaii: "HI",
    idaho: "ID",
    illinois: "IL",
    indiana: "IN",
    iowa: "IA",
    kansas: "KS",
    kentucky: "KY",
    louisiana: "LA",
    maine: "ME",
    maryland: "MD",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    mississippi: "MS",
    missouri: "MO",
    montana: "MT",
    nebraska: "NE",
    nevada: "NV",
    "new-hampshire": "NH",
    "new-jersey": "NJ",
    "new-mexico": "NM",
    "new-york": "NY",
    "north-carolina": "NC",
    "north-dakota": "ND",
    ohio: "OH",
    oklahoma: "OK",
    oregon: "OR",
    pennsylvania: "PA",
    "puerto-rico": "PR",
    "south-carolina": "SC",
    "south-dakota": "SD",
    tennessee: "TN",
    texas: "TX",
    utah: "UT",
    vermont: "VT",
    virginia: "VA",
    washington: "WA",
    "west-virginia": "WV",
    wisconsin: "WI",
    wyoming: "WY"
  };

  return map[slug] ?? slug.slice(0, 2).toUpperCase();
}

function hashExternalId({ state, locationName, fullAddress }) {
  return crypto
    .createHash("sha1")
    .update([state, locationName, fullAddress].join("|"))
    .digest("hex");
}

function dedupeLocations(locations) {
  const map = new Map();

  for (const location of locations) {
    if (!map.has(location.externalId)) {
      map.set(location.externalId, location);
    }
  }

  return [...map.values()];
}

function extractFirstPlanLink(html) {
  const signupMatch = html.match(/https:\/\/signup\.anytimemailbox\.com\/signup\/new\?term=(\d+)&srvPlnId=(\d+)/i);
  if (signupMatch) {
    return {
      url: signupMatch[0],
      term: Number(signupMatch[1]),
      srvPlnId: Number(signupMatch[2])
    };
  }

  const relativeMatch = html.match(/\/signup\/new\?term=(\d+)&srvPlnId=(\d+)/i);
  if (!relativeMatch) {
    return null;
  }

  return {
    url: new URL(relativeMatch[0], "https://signup.anytimemailbox.com").toString(),
    term: Number(relativeMatch[1]),
    srvPlnId: Number(relativeMatch[2])
  };
}

function extractPersonalizeRange(html) {
  const $ = cheerio.load(html);
  const options = $("#f_boxid option")
    .map((_, option) => normalizeWhitespace($(option).text()))
    .get()
    .filter(Boolean);

  if (options.length === 0) {
    return {
      min: null,
      max: null,
      error: "Personalize Your Address options not found."
    };
  }

  const numbers = options
    .map((option) => {
      const match = option.match(/(\d+)/);
      return match ? Number(match[1]) : null;
    })
    .filter((value) => Number.isFinite(value));

  if (numbers.length === 0) {
    return {
      min: null,
      max: null,
      error: "No numeric personalize values found."
    };
  }

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    error: null
  };
}

function extractListingsFromStatePageFallback(html, statePage) {
  const lines = extractLinesFromHtml(html);
  const cards = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== "Starting from") {
      continue;
    }

    const locationName = lines[index - 1];
    const priceLine = lines[index + 1];
    const streetLine = lines[index + 2];
    const cityStateZipLine = lines[index + 3];

    if (!locationName || !priceLine || !streetLine || !cityStateZipLine) {
      continue;
    }

    const priceMatch = priceLine.match(/US\$\s*([\d,.]+)\s*\/\s*(month|year)/i);
    const parsedAddress = parseAddressLines(streetLine, cityStateZipLine);
    if (!priceMatch || !parsedAddress) {
      continue;
    }

    const monthlyPrice = normalizePrice(
      Number(priceMatch[1].replace(/,/g, "")),
      priceMatch[2].toLowerCase()
    );
    const fullAddress = `${parsedAddress.street}, ${parsedAddress.city}, ${parsedAddress.state} ${parsedAddress.postalCode}`;
    const externalId = hashExternalId({
      state: parsedAddress.state,
      locationName,
      fullAddress
    });

    cards.push({
      externalId,
      locationName,
      fullAddress,
      street: parsedAddress.street,
      street2: null,
      city: parsedAddress.city,
      state: parsedAddress.state,
      postalCode: parsedAddress.postalCode,
      country: "US",
      monthlyPrice,
      currency: "USD",
      priceText: priceLine,
      priceType: priceMatch[2].toLowerCase() === "year" ? "from_yearly" : "from",
      detailUrl: null,
      sourceUrl: statePage.url,
      services: [],
      rdi: null,
      cmra: null,
      raw: {
        locationName,
        priceLine,
        streetLine,
        cityStateZipLine,
        statePage
      }
    });
  }

  return dedupeLocations(cards);
}
