const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// The original source, https://www.visitpanamacitybeach.com/beach-alerts-iframe/,
// returns a hard 403 "Access Denied" from Akamai for this project's requests
// (confirmed via response headers/body — an edge-level block, not a bot-fingerprint
// issue). The public-facing conditions page below shows the same information and
// is not behind that same restriction.
const URL_TO_FETCH = 'https://www.visitpanamacitybeach.com/stay-pcb-current/';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
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
        validateStatus: () => true,
      });

      if (response.status >= 200 && response.status < 300) {
        return response;
      }

      console.error(`Attempt ${attempt}/${MAX_ATTEMPTS} failed with status ${response.status}`);
      console.error('Response headers:', JSON.stringify(response.headers, null, 2));
      const bodySnippet =
        typeof response.data === 'string' ? response.data.slice(0, 1000) : JSON.stringify(response.data).slice(0, 1000);
      console.error('Response body (first 1000 chars):', bodySnippet);

      lastError = new Error(`Request failed with status code ${response.status}`);
    } catch (err) {
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

// Maps a raw flag color label (as displayed on the page, e.g. "Yellow Flag",
// "Double Red Flag") to the descriptive sentence this project has always output.
function describeFlagColor(rawLabel) {
  const text = rawLabel.toLowerCase();
  let description = '';

  if (text.includes('double red')) {
    description = 'double red. The water is closed to the public.';
  } else if (text.includes('red')) {
    description = 'red. This color indicates strong surf and/or currents, and you should not enter the water above knee level.';
  } else if (text.includes('yellow')) {
    description = 'yellow. This color indicates medium hazard, moderate surf and/or strong currents.';
  } else if (text.includes('green')) {
    description = 'green. This color indicates generally low hazard with calm conditions.';
  }

  if (text.includes('purple')) {
    description += (description ? ' ' : '') + 'Purple flags are also flying on the beach, indicating dangerous marine life such as jellyfish are present.';
  }

  return description;
}

async function getFlagDescription(url) {
  const response = await fetchWithRetry(url);
  const dom = new JSDOM(response.data);
  const document = dom.window.document;

  // Primary signal: the "Current Beach Conditions:" heading is followed
  // directly by the human-readable flag label (e.g. "Yellow Flag").
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, strong'));
  const conditionsHeading = headings.find((el) =>
    el.textContent.trim().toLowerCase().startsWith('current beach conditions')
  );

  let rawLabel = '';
  if (conditionsHeading) {
    // The label is usually the next sibling element with visible text.
    let node = conditionsHeading.nextElementSibling;
    while (node && !node.textContent.trim()) {
      node = node.nextElementSibling;
    }
    if (node) {
      rawLabel = node.textContent.trim();
    }
  }

  // Fallback / cross-check: pull the color out of the flag image's filename,
  // e.g. ".../yellow_weather_flag_2x_....png" -> "yellow".
  let imageColorMatch = '';
  const flagImage = Array.from(document.querySelectorAll('img')).find((img) =>
    (img.getAttribute('src') || '').includes('_weather_flag_')
  );
  if (flagImage) {
    const src = flagImage.getAttribute('src');
    const match = src.match(/\/([a-z_]+?)_weather_flag_/i);
    if (match) {
      imageColorMatch = match[1].replace(/_/g, ' ');
    }
  }

  const labelToUse = rawLabel || imageColorMatch;

  if (!labelToUse) {
    throw new Error('Could not find a current flag condition label or image on the page.');
  }

  const flagStatusDescription = describeFlagColor(labelToUse);

  if (!flagStatusDescription) {
    throw new Error(`The script could not map the retrieved label ("${labelToUse}") to a known flag color.`);
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
