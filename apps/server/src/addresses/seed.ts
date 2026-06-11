import type { DatabaseContext } from '@atmb/db';

const now = '2026-06-07T08:00:00.000Z';

const stateSeeds = [
  ['Alabama', 'AL', 'alabama', 'https://www.anytimemailbox.com/l/usa/alabama', 15, 4, 3],
  ['Texas', 'TX', 'texas', 'https://www.anytimemailbox.com/l/usa/texas', 281, 1, 1],
  ['Arizona', 'AZ', 'arizona', 'https://www.anytimemailbox.com/l/usa/arizona', 53, 1, 0],
] as const;

const addressSeeds = [
  {
    name: 'Madison, AL 35758',
    slug: 'madison-7169-hwy-72-w',
    anytimeUrl: 'https://www.anytimemailbox.com/s/madison-7169-hwy-72-w',
    signupUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=30467',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=7169%20Hwy%2072%20W%20Ste%20A%20Madison%20AL%2035758',
    state: 'AL',
    stateName: 'Alabama',
    city: 'Madison',
    streetAddress: '7169 Hwy 72 W Ste A',
    postalCode: '35758',
    fullAddress: '7169 Hwy 72 W Ste A Madison, AL 35758 United States',
    priceCents: 1999,
    rdi: 'Residential',
    cmra: 'No',
    mailboxMin: 1018,
    mailboxMax: 1119,
    mailboxNumbersJson: '[1018,1019,1047,1119]',
    isFeatured: 1,
    statusNote: '精选住宅地址',
  },
  {
    name: 'Birmingham, AL 35203',
    slug: 'birmingham-120-19th-street-north',
    anytimeUrl: 'https://www.anytimemailbox.com/s/birmingham-120-19th-street-north',
    signupUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=15442',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=120%2019th%20Street%20North%20Birmingham%20AL%2035203',
    state: 'AL',
    stateName: 'Alabama',
    city: 'Birmingham',
    streetAddress: '120 19th Street North',
    postalCode: '35203',
    fullAddress: '120 19th Street North Birmingham, AL 35203 United States',
    priceCents: 3900,
    rdi: 'Residential',
    cmra: 'No',
    mailboxMin: 2013,
    mailboxMax: 2186,
    mailboxNumbersJson: '[2013,2040,2186]',
    isFeatured: 1,
    statusNote: 'Top rated',
  },
  {
    name: 'Birmingham, AL 35235',
    slug: 'birmingham-1430-gadsden-highway',
    anytimeUrl: 'https://www.anytimemailbox.com/s/birmingham-1430-gadsden-highway',
    signupUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=11908',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=1430%20Gadsden%20Highway%20Suite%20116%20Birmingham%20AL%2035235',
    state: 'AL',
    stateName: 'Alabama',
    city: 'Birmingham',
    streetAddress: '1430 Gadsden Highway Suite 116',
    postalCode: '35235',
    fullAddress: '1430 Gadsden Highway Suite 116 Birmingham, AL 35235 United States',
    priceCents: 1499,
    rdi: 'Commercial',
    cmra: 'Yes',
    mailboxMin: 3001,
    mailboxMax: 3199,
    mailboxNumbersJson: '[3001,3050,3199]',
    isFeatured: 0,
    statusNote: '商业地址候选',
  },
  {
    name: 'Huntsville, AL 35802',
    slug: 'huntsville-7900-bailey-cove-rd-se',
    anytimeUrl: 'https://www.anytimemailbox.com/s/huntsville-7900-bailey-cove-rd-se',
    signupUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=31855',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=7900%20Bailey%20Cove%20Rd%20SE%20Huntsville%20AL%2035802',
    state: 'AL',
    stateName: 'Alabama',
    city: 'Huntsville',
    streetAddress: '7900 Bailey Cove Rd SE',
    postalCode: '35802',
    fullAddress: '7900 Bailey Cove Rd SE Huntsville, AL 35802 United States',
    priceCents: 1999,
    rdi: 'Residential',
    cmra: 'No',
    mailboxMin: 4000,
    mailboxMax: 4999,
    mailboxNumbersJson: '[4000,4101,4999]',
    isFeatured: 1,
    statusNote: '住宅地址候选',
  },
  {
    name: 'Dallas, TX 75201',
    slug: 'dallas-75201-sample',
    anytimeUrl: 'https://www.anytimemailbox.com/s/dallas-75201-sample',
    signupUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=32175',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Dallas%20TX%2075201',
    state: 'TX',
    stateName: 'Texas',
    city: 'Dallas',
    streetAddress: '示例地址内容用于列表布局',
    postalCode: '75201',
    fullAddress: 'Dallas, TX 75201 United States',
    priceCents: 2499,
    rdi: 'Residential',
    cmra: 'No',
    mailboxMin: 850,
    mailboxMax: 999,
    mailboxNumbersJson: '[850,900,999]',
    isFeatured: 0,
    statusNote: '示例住宅地址',
  },
  {
    name: 'Phoenix, AZ 85004',
    slug: 'phoenix-85004-sample',
    anytimeUrl: 'https://www.anytimemailbox.com/s/phoenix-85004-sample',
    signupUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=29184',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Phoenix%20AZ%2085004',
    state: 'AZ',
    stateName: 'Arizona',
    city: 'Phoenix',
    streetAddress: '示例地址内容用于价格筛选',
    postalCode: '85004',
    fullAddress: 'Phoenix, AZ 85004 United States',
    priceCents: 899,
    rdi: 'Commercial',
    cmra: 'Yes',
    mailboxMin: 120,
    mailboxMax: 199,
    mailboxNumbersJson: '[120,150,199]',
    isFeatured: 0,
    statusNote: '价格变化',
  },
] as const;

export function seedDevelopmentAddresses(database: DatabaseContext) {
  const row = database.sqlite.prepare('SELECT COUNT(*) AS count FROM addresses').get() as { count: number };

  if (row.count > 0) {
    return;
  }

  const insertState = database.sqlite.prepare(`
    INSERT INTO states (
      name, code, slug, country, anytime_url, location_count, active_address_count,
      residential_count, last_crawled_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'United States', ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const state of stateSeeds) {
    insertState.run(...state, now, now, now);
  }

  const insertAddress = database.sqlite.prepare(`
    INSERT INTO addresses (
      name, slug, anytime_url, signup_url, google_maps_url, country, state, state_name,
      city, street_address, postal_code, full_address, price_cents, price_currency, price_period,
      rdi, cmra, mailbox_min, mailbox_max, mailbox_count, mailbox_numbers_json, is_featured,
      is_active, is_visible, status_note, last_crawled_at, first_seen_at, created_at, updated_at
    ) VALUES (
      @name, @slug, @anytimeUrl, @signupUrl, @googleMapsUrl, 'United States', @state, @stateName,
      @city, @streetAddress, @postalCode, @fullAddress, @priceCents, 'USD', 'month',
      @rdi, @cmra, @mailboxMin, @mailboxMax, @mailboxCount, @mailboxNumbersJson, @isFeatured,
      1, 1, @statusNote, @lastCrawledAt, @firstSeenAt, @createdAt, @updatedAt
    )
  `);
  const insertEvent = database.sqlite.prepare(`
    INSERT INTO address_events (address_id, event_type, new_value, message, created_at)
    VALUES (?, 'added', ?, '开发种子数据', ?)
  `);

  for (const address of addressSeeds) {
    const mailboxCount = address.mailboxMax - address.mailboxMin + 1;
    const result = insertAddress.run({
      ...address,
      mailboxCount,
      lastCrawledAt: now,
      firstSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });
    insertEvent.run(result.lastInsertRowid, address.anytimeUrl, now);
  }
}
