const { fetchCountedStateLocations, fetchFirstCountedStateLocations } = require('./fetchHtml');

const DEFAULT_URL = 'https://www.anytimemailbox.com/l/usa';
const TEST_MODE = true;
const RUN_OPTIONS = {
  includeLocationDetails: true,
};

async function main() {
  const result = TEST_MODE
    ? await fetchFirstCountedStateLocations(DEFAULT_URL, RUN_OPTIONS)
    : await fetchCountedStateLocations(DEFAULT_URL, RUN_OPTIONS);

  console.dir(result, { depth: null });
}

main()
