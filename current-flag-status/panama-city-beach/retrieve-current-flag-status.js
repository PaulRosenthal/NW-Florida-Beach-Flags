const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function getFlagDescription(url) {
  const config = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.google.com/'
    }
  };

  const response = await axios.get(url, config);
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
  const url = 'https://www.visitpanamacitybeach.com/beach-alerts-iframe/';
  try {
    const result = await getFlagDescription(url);
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
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  }
}

main();
