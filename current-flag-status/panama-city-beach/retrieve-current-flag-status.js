const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function getFlagDescription(url) {
  // Launch the browser
  const browser = await puppeteer.launch({
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Mandatory for GitHub Actions
  });
  
  const page = await browser.newPage();
  
  // Navigate to the site
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Wait for the flag element to load
  await page.waitForSelector('.flag-description');

  // Extract the text content
  const statusText = await page.$eval('.flag-description', el => el.textContent.toLowerCase());
  
  await browser.close();

  // --- Parsing Logic ---
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
    
    // Ensure directory exists
    const dir = path.dirname(outputFilePath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFile(outputFilePath, result, (err) => {
      if (err) {
        console.error(err);
        process.exitCode = 1;
      } else {
        console.log('The flag status has been saved to the file:', outputFilePath);
      }
    });
  } catch (error) {
    console.error('Error fetching flag status:', error.message);
    process.exitCode = 1;
  }
}

main();
