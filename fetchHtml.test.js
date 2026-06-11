const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  fetchCountedStateLocations,
  fetchFirstCountedStateLocations,
  fetchHtmlToResultFolder,
  parseLocationDetail,
  parseLocationList,
  parseMailboxNumberRange,
  parseStateList,
} = require('./fetchHtml');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

test('fetches html from a url and saves it under resultHtml', async (t) => {
  const html = '<!doctype html><html><body><h1>Hello ATMB</h1></body></html>';
  const server = http.createServer((request, response) => {
    assert.equal(request.url, '/page?name=a');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(html);
  });

  const port = await listen(server);
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'atmb-html-'));
  const result = await fetchHtmlToResultFolder(`http://127.0.0.1:${port}/page?name=a`, {
    cwd,
  });

  assert.equal(result.status, 200);
  assert.equal(result.html, html);
  assert.equal(path.dirname(result.filePath), path.join(cwd, 'resultHtml'));
  assert.equal(path.basename(result.filePath), `127.0.0.1-${port}-page-name-a.html`);
  assert.equal(await fs.readFile(result.filePath, 'utf8'), html);
});

test('parses state name link and count from html', () => {
  const html = `
    <section>
      <a href="/l/usa/alabama">Alabama <span>15</span></a>
      <a href="/l/usa/california">California <span class="badge">391</span></a>
      <a href="/l/usa/rhode-island">Rhode Island</a>
    </section>
  `;

  assert.deepEqual(parseStateList(html, 'https://www.anytimemailbox.com/l/usa'), [
    {
      name: 'Alabama',
      url: 'https://www.anytimemailbox.com/l/usa/alabama',
      count: 15,
    },
    {
      name: 'California',
      url: 'https://www.anytimemailbox.com/l/usa/california',
      count: 391,
    },
    {
      name: 'Rhode Island',
      url: 'https://www.anytimemailbox.com/l/usa/rhode-island',
      count: null,
    },
  ]);
});

test('parses counts from badges beside state links in the location list', () => {
  const html = `
    <nav>
      <a href="/l/usa/california">California</a>
    </nav>
    <div class="loc-list-container">
      <a class="theme-loc-link" href="/l/usa/alabama">Alabama</a>
      <span class="badge loc-theme-badge loc-margin-left">15</span>
      <br>
      <a class="theme-loc-link" href="/l/usa/california">California</a>
      <span class="badge loc-theme-badge loc-margin-left">391</span>
    </div>
  `;

  assert.deepEqual(parseStateList(html, 'https://www.anytimemailbox.com/l/usa'), [
    {
      name: 'Alabama',
      url: 'https://www.anytimemailbox.com/l/usa/alabama',
      count: 15,
    },
    {
      name: 'California',
      url: 'https://www.anytimemailbox.com/l/usa/california',
      count: 391,
    },
  ]);
});

test('keeps location-list entries without state directory hrefs', () => {
  const html = `
    <div class="loc-list-container">
      <a class="theme-loc-link" href="/s/fargo-19-8th-street-south">North Dakota</a>
      <br>
      <a class="theme-loc-link" href="/s/providence-203-weybosset-st">Rhode Island</a>
      <br>
      <a class="theme-loc-link" href="/s/lewisburg-3558-n-jefferson-street">West Virginia</a>
    </div>
  `;

  assert.deepEqual(parseStateList(html, 'https://www.anytimemailbox.com/l/usa'), [
    {
      name: 'North Dakota',
      url: 'https://www.anytimemailbox.com/s/fargo-19-8th-street-south',
      count: null,
    },
    {
      name: 'Rhode Island',
      url: 'https://www.anytimemailbox.com/s/providence-203-weybosset-st',
      count: null,
    },
    {
      name: 'West Virginia',
      url: 'https://www.anytimemailbox.com/s/lewisburg-3558-n-jefferson-street',
      count: null,
    },
  ]);
});

test('parses mailbox location name address price and link from a state page', () => {
  const html = `
    <div class="theme-location-item">
      <h3 class="t-title">Birmingham - 19th St</h3>
      <div class="t-price">Starting from <br><b>US$ 39.00</b> / month</div>
      <div class="t-addr">120 19th Street North<br/>Birmingham, AL 35203<br/></div>
      <a class="btn theme-button btn-block gt-plan" href="/s/birmingham-120-19th-street-north">Select Plan</a>
    </div>
    <div class="theme-location-item">
      <h3 class="t-title">Birmingham - 1st Ave</h3>
      <div class="t-price">Starting from <br><b>US$ 14.99</b> / month</div>
      <div class="t-addr">7841 1st Ave N<br/>Birmingham, AL 35206<br/></div>
      <a class="btn theme-button btn-block gt-plan" href="/s/birmingham-7841-1st-ave-north">Select Plan</a>
    </div>
  `;

  assert.deepEqual(parseLocationList(html, 'https://www.anytimemailbox.com/l/usa/alabama'), [
    {
      name: 'Birmingham - 19th St',
      address: '120 19th Street North Birmingham, AL 35203',
      price: 'US$ 39.00',
      url: 'https://www.anytimemailbox.com/s/birmingham-120-19th-street-north',
    },
    {
      name: 'Birmingham - 1st Ave',
      address: '7841 1st Ave N Birmingham, AL 35206',
      price: 'US$ 14.99',
      url: 'https://www.anytimemailbox.com/s/birmingham-7841-1st-ave-north',
    },
  ]);
});

test('test mode fetches only the first state that has a count', async (t) => {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (request.url === '/l/usa') {
      response.end(`
        <div class="loc-list-container">
          <a class="theme-loc-link" href="/l/usa/alabama">Alabama</a>
          <span class="badge loc-theme-badge loc-margin-left">15</span>
          <br>
          <a class="theme-loc-link" href="/l/usa/alaska">Alaska</a>
          <span class="badge loc-theme-badge loc-margin-left">3</span>
        </div>
      `);
      return;
    }

    if (request.url === '/l/usa/alabama') {
      response.end(`
        <div class="theme-location-item">
          <h3 class="t-title">Birmingham - 19th St</h3>
          <div class="t-price">Starting from <br><b>US$ 39.00</b> / month</div>
          <div class="t-addr">120 19th Street North<br/>Birmingham, AL 35203<br/></div>
          <a class="btn gt-plan" href="/s/birmingham-120-19th-street-north">Select Plan</a>
        </div>
      `);
      return;
    }

    response.statusCode = 404;
    response.end('not found');
  });

  const port = await listen(server);
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const result = await fetchFirstCountedStateLocations(`http://127.0.0.1:${port}/l/usa`, {
    cwd: await fs.mkdtemp(path.join(os.tmpdir(), 'atmb-location-')),
  });

  assert.deepEqual(requests, ['/l/usa', '/l/usa/alabama']);
  assert.equal(result.state.name, 'Alabama');
  assert.equal(result.state.count, 15);
  assert.deepEqual(result.locations, [
    {
      name: 'Birmingham - 19th St',
      address: '120 19th Street North Birmingham, AL 35203',
      price: 'US$ 39.00',
      url: `http://127.0.0.1:${port}/s/birmingham-120-19th-street-north`,
    },
  ]);
});

test('full mode fetches every state that has a count', async (t) => {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (request.url === '/l/usa') {
      response.end(`
        <div class="loc-list-container">
          <a class="theme-loc-link" href="/l/usa/alabama">Alabama</a>
          <span class="badge loc-theme-badge loc-margin-left">15</span>
          <br>
          <a class="theme-loc-link" href="/s/providence-203-weybosset-st">Rhode Island</a>
          <br>
          <a class="theme-loc-link" href="/l/usa/alaska">Alaska</a>
          <span class="badge loc-theme-badge loc-margin-left">3</span>
        </div>
      `);
      return;
    }

    if (request.url === '/l/usa/alabama') {
      response.end(`
        <div class="theme-location-item">
          <h3 class="t-title">Birmingham - 19th St</h3>
          <div class="t-price"><b>US$ 39.00</b></div>
          <div class="t-addr">120 19th Street North<br/>Birmingham, AL 35203</div>
          <a class="btn gt-plan" href="/s/birmingham-120-19th-street-north">Select Plan</a>
        </div>
      `);
      return;
    }

    if (request.url === '/l/usa/alaska') {
      response.end(`
        <div class="theme-location-item">
          <h3 class="t-title">Anchorage</h3>
          <div class="t-price"><b>US$ 29.99</b></div>
          <div class="t-addr">123 Snow Rd<br/>Anchorage, AK 99501</div>
          <a class="btn gt-plan" href="/s/anchorage-123-snow-rd">Select Plan</a>
        </div>
      `);
      return;
    }

    response.statusCode = 404;
    response.end('not found');
  });

  const port = await listen(server);
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const result = await fetchCountedStateLocations(`http://127.0.0.1:${port}/l/usa`, {
    cwd: await fs.mkdtemp(path.join(os.tmpdir(), 'atmb-all-locations-')),
  });

  assert.deepEqual(requests, ['/l/usa', '/l/usa/alabama', '/l/usa/alaska']);
  assert.equal(result.stateResults.length, 2);
  assert.deepEqual(
    result.stateResults.map((item) => item.state.name),
    ['Alabama', 'Alaska'],
  );
  assert.deepEqual(
    result.stateResults.map((item) => item.locations[0].name),
    ['Birmingham - 19th St', 'Anchorage'],
  );
});

test('parses signup link and selected detail address parts from a location page', () => {
  const html = `
    <div class="t-addr">
      <div class="t-title">Your Real Street Address</div>
      <div class="t-text">
        <div><span class="t-placeholder">YOUR NAME</span></div>
        <div>120 19th Street North</div>
        <div>Suite -# <span class="t-placeholder">MAILBOX</span></div>
        <div>Birmingham, AL 35203</div>
        <div>United States</div>
      </div>
    </div>
    <button id="myear" onclick="location.href=https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=15442">
      Select
    </button>
  `;

  assert.deepEqual(parseLocationDetail(html, 'https://www.anytimemailbox.com/s/birmingham-120-19th-street-north'), {
    myearUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=15442',
    detailAddress: '120 19th Street North Suite Birmingham, AL 35203 United States',
    country: 'United States',
    state: 'AL',
    city: 'Birmingham',
    address: '120 19th Street North Suite',
    zip: '35203',
  });
});

test('skips placeholder-only mailbox rows when detail address has an extra suite row', () => {
  const html = `
    <div class="t-addr">
      <div class="t-text">
        <div><span class="t-placeholder">YOUR NAME</span></div>
        <div>1430 Gadsden Highway</div>
        <div>Suite 116</div>
        <div>Unit #<span class="t-placeholder">MAILBOX</span></div>
        <div>Birmingham, AL 35235</div>
        <div>United States</div>
      </div>
    </div>
    <button id="myear" onclick="location.href=https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=11908">
      Select
    </button>
  `;

  assert.deepEqual(parseLocationDetail(html, 'https://www.anytimemailbox.com/s/birmingham-1430-gadsden-highway'), {
    myearUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=11908',
    detailAddress: '1430 Gadsden Highway Suite 116 Birmingham, AL 35235 United States',
    country: 'United States',
    state: 'AL',
    city: 'Birmingham',
    address: '1430 Gadsden Highway Suite 116',
    zip: '35235',
  });
});

test('removes unit keyword case-insensitively from detail address unit text', () => {
  const html = `
    <div class="t-addr">
      <div class="t-text">
        <div><span class="t-placeholder">YOUR NAME</span></div>
        <div>1430 Gadsden Highway</div>
        <div>Suite uNiT #116</div>
        <div>Birmingham, AL 35235</div>
        <div>United States</div>
      </div>
    </div>
    <a id="myear" href="/signup/birmingham-monthly">Select</a>
  `;

  assert.deepEqual(parseLocationDetail(html, 'https://www.anytimemailbox.com/s/birmingham-1430-gadsden-highway'), {
    myearUrl: 'https://www.anytimemailbox.com/signup/birmingham-monthly',
    detailAddress: '1430 Gadsden Highway Suite 116 Birmingham, AL 35235 United States',
    country: 'United States',
    state: 'AL',
    city: 'Birmingham',
    address: '1430 Gadsden Highway Suite 116',
    zip: '35235',
  });
});

test('parses compact detail address and removes # MAILBOX with a space', () => {
  const html = `
    <div class="t-addr">
      <div class="t-text">
        <div>YOUR NAME</div>
        <div>3011 Town Center Dr Ste 130 # MAILBOX</div>
        <div>Fayetteville, NC 28306</div>
        <div>United States</div>
      </div>
    </div>
    <a id="myear" href="/signup/fayetteville">Select</a>
  `;

  assert.deepEqual(parseLocationDetail(html, 'https://www.anytimemailbox.com/s/fayetteville-3011-town-center-drive'), {
    myearUrl: 'https://www.anytimemailbox.com/signup/fayetteville',
    detailAddress: '3011 Town Center Dr Ste 130 Fayetteville, NC 28306 United States',
    country: 'United States',
    state: 'NC',
    city: 'Fayetteville',
    address: '3011 Town Center Dr Ste 130',
    zip: '28306',
  });
});

test('parses mailbox option numbers and range from signup page', () => {
  const html = `
    <select id="f_boxid">
      <option>Select a mailbox</option>
      <option>101</option>
      <option>  86  </option>
      <option>305</option>
      <option></option>
    </select>
  `;

  assert.deepEqual(parseMailboxNumberRange(html), {
    mailboxNumbers: [101, 86, 305],
    mailboxMin: 86,
    mailboxMax: 305,
  });
});

test('parses mailbox option numbers with letter prefixes from signup page', () => {
  const html = `
    <select id="f_boxid">
      <option value="2652919">V1018</option>
      <option value="2652920">V1019</option>
      <option value="2652948">V1047</option>
    </select>
  `;

  assert.deepEqual(parseMailboxNumberRange(html), {
    mailboxNumbers: [1018, 1019, 1047],
    mailboxMin: 1018,
    mailboxMax: 1047,
  });
});

test('fetches detail page data for each location when enabled', async (t) => {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (request.url === '/l/usa') {
      response.end(`
        <div class="loc-list-container">
          <a class="theme-loc-link" href="/l/usa/alabama">Alabama</a>
          <span class="badge loc-theme-badge loc-margin-left">15</span>
        </div>
      `);
      return;
    }

    if (request.url === '/l/usa/alabama') {
      response.end(`
        <div class="theme-location-item">
          <h3 class="t-title">Birmingham - 19th St</h3>
          <div class="t-price"><b>US$ 39.00</b></div>
          <div class="t-addr">120 19th Street North<br/>Birmingham, AL 35203</div>
          <a class="btn gt-plan" href="/s/birmingham-120-19th-street-north">Select Plan</a>
        </div>
      `);
      return;
    }

    if (request.url === '/s/birmingham-120-19th-street-north') {
      response.end(`
        <div class="t-addr">
          <div class="t-text">
            <div>YOUR NAME</div>
            <div>120 19th Street North</div>
            <div>Suite -# <span>MAILBOX</span></div>
            <div>Birmingham, AL 35203</div>
            <div>United States</div>
          </div>
        </div>
        <a id="myear" href="/signup/new?term=30&srvPlnId=15442">Select</a>
      `);
      return;
    }

    if (request.url === '/signup/new?term=30&srvPlnId=15442') {
      response.statusCode = 301;
      response.setHeader('Set-Cookie', 'signup_session=abc123; Path=/; HttpOnly');
      response.setHeader('Location', '/signup/account?t=30&sp=15442');
      response.end('redirect');
      return;
    }

    if (request.url === '/signup/account?t=30&sp=15442') {
      if (!request.headers.cookie || !request.headers.cookie.includes('signup_session=abc123')) {
        response.statusCode = 301;
        response.setHeader('Location', '/s/birmingham-120-19th-street-north');
        response.end('missing cookie');
        return;
      }

      response.end(`
        <select id="f_boxid">
          <option>100</option>
          <option>24</option>
          <option>301</option>
        </select>
      `);
      return;
    }

    response.statusCode = 404;
    response.end('not found');
  });

  const port = await listen(server);
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const result = await fetchFirstCountedStateLocations(`http://127.0.0.1:${port}/l/usa`, {
    cwd: await fs.mkdtemp(path.join(os.tmpdir(), 'atmb-location-detail-')),
    includeLocationDetails: true,
  });

  assert.deepEqual(requests, [
    '/l/usa',
    '/l/usa/alabama',
    '/s/birmingham-120-19th-street-north',
    '/signup/new?term=30&srvPlnId=15442',
    '/signup/account?t=30&sp=15442',
  ]);
  assert.deepEqual(result.locations, [
    {
      name: 'Birmingham - 19th St',
      address: '120 19th Street North Birmingham, AL 35203',
      price: 'US$ 39.00',
      url: `http://127.0.0.1:${port}/s/birmingham-120-19th-street-north`,
      myearUrl: `http://127.0.0.1:${port}/signup/new?term=30&srvPlnId=15442`,
      detailAddress: '120 19th Street North Suite Birmingham, AL 35203 United States',
      country: 'United States',
      state: 'AL',
      city: 'Birmingham',
      address: '120 19th Street North Suite',
      zip: '35203',
      mailboxNumbers: [100, 24, 301],
      mailboxMin: 24,
      mailboxMax: 301,
      detailFilePath: result.locations[0].detailFilePath,
      myearFilePath: result.locations[0].myearFilePath,
    },
  ]);
  assert.match(result.locations[0].detailFilePath, /birmingham-120-19th-street-north\.html$/);
  assert.match(result.locations[0].myearFilePath, /signup-new-term-30-srvPlnId-15442\.html$/);
});
