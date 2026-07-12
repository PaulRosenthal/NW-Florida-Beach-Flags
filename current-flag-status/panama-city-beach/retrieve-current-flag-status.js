const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const URL_TO_FETCH = 'https://www.visitpanamacitybeach.com/beach-alerts-iframe/';

// Headers modeled on a real desktop Chrome browser request. Many WAFs (Cloudflare,
// Akamai, Imperva, etc.) fingerprint bare HTTP-library requests (e.g. axios's
// default "axios/1.x.x" User-Agent, missing Accept/Accept-Language/Referer) and
// block them outright, independent of the source IP.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.visitpanamacitybeach.com/',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'iframe',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout: 15000,
        // Treat any status as "resolved" so we can inspect and log it ourselves
        // instead of axios throwing a bare, low-detail error.
        validateStatus: () => true,
      });

      if (response.status >= 200 && response.status < 300) {
        return response;
      }

      // Log as much as we can about the failure so the next investigation
      // doesn't start from scratch.
      console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed with status ${response.status}`);
      console.error('Response headers:', JSON.stringify(response.headers, null, 2));
      const bodySnippet =
        typeof response.data === 'string' ? response.data.slice(0, 1000) : JSON.stringify(response.data).slice(0, 1000);
      console.error('Response body (first 1000 chars):', bodySnippet);

      lastError = new Error(`Request failed with status code ${response.status}`);
    } catch (err) {
      // Network-level errors (timeout, DNS, connection reset, etc.)
      console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} threw an error:`, err.message);
      lastError = err;
    }

    if (attempt < MAX_ATTEMPTS) {
      console.log(`Waiting ${RETRY_DELAY_MS}ms before retrying...`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

async function getFlagDescription(url) {
  const response = await fetchWithRetry(url);
  const dom = new JSDOM(response.data);
  const flagStatusElement = dom.window.document.querySelector('.flag-description');

  if (!flagStatusElement) {
    throw new Error('No flag description found in the flag status text that was retrieved.');
  }

  const statusText = flagStatusElement.textContent.toLowerCase();
  let flagStatusDescription = '';

  if (statusText.includes('medium') || statusText.includes('yellow')) {
    flagStatusDescription = 'yellow. This color indicates medium hazard, moderate surf and/or strong currents.';
  } else if (statusText.includes('low') || statusText.includes('green')) {
    flagStatusDescription = 'green. This color indicates generally low hazard with calm conditions.';
  } else if (statusText.includes('closed') || statusText.includes('double red') || statusText.includes('high hazard')) {
    flagStatusDescription = 'double red. The water is closed to the public.';
  } else if (statusText.includes('strong') || statusText.includes('red') || statusText.includes('high')) {
    flagStatusDescription = 'red. This color indicates strong surf and/or currents, and you should not enter the water above knee level.';
  }

  if (statusText.includes('marine') || statusText.includes('purple')) {
    flagStatusDescription += ' Purple flags are also flying on the beach, indicating dangerous marine life such as jellyfish are present.';
  }

  if (!flagStatusDescription) {
    throw new Error('The script could not determine the current flag color from the retrieved text.');
  }

  return `The beach safety flags in Panama City Beach are ${flagStatusDescription}`;
}

async function main() {
  try {
    const result = await getFlagDescription(URL_TO_FETCH);
    console.log(result);

    const outputFilePath = path.join(__dirname, '..', '..', 'flag-status', 'panama-city-beach.txt');
    fs.writeFile(outputFilePath, result, (err) => {
      if (err) {
        console.error(err);
        process.exitCode = 1;
      } else {
        console.log('The flag status has been saved to the file:', outputFilePath);
      }
    });
  } catch (err) {
    console.error('Failed to retrieve Panama City Beach flag status:', err.message);
    process.exitCode = 1;
  }
}

main();
