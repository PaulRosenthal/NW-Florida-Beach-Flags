const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function getFlagDescription(url) {
  // Launch the browser with standard settings for GitHub Actions
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set a realistic user agent to look less like a bot
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // --- DEBUGGING BLOCK ---
  // This dumps the raw HTML so you can see if you're being blocked
  const bodyContent = await page.evaluate(() => document.body.innerHTML);
  console.log('--- START HTML DUMP (First 1000 chars) ---');
  console.log(bodyContent.substring(0, 1000));
  console.log('--- END HTML DUMP ---');
  // -----------------------

  // Wait for the flag element
  try {
    await page.waitForSelector('.flag-description', { timeout: 15000 });
  } catch (e) {
    console.error('Selector .flag-description not found.');
    // Optional: Take a screenshot if you have write access to the runner
    await page.screenshot({ path: 'failure-screenshot.png' });
    throw new Error('Failed to find .flag-description. Check the HTML dump above.');
  }

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

  return `The beach safety flags in Panama City Beach are ${flagStatusDescription}`;
}

async function main() {
  const url = 'https://www.visitpanamacitybeach.com/beach-alerts-iframe/';
  try {
    const result = await getFlagDescription(url);
    console.log(result);

    const outputFilePath = path.join(__dirname, '..', '..', 'flag-status', 'panama-city-beach.txt');
    const dir = path.dirname(outputFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFile(outputFilePath, result, (err) => {
      if (err) throw err;
      console.log('Saved to:', outputFilePath);
    });
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
    process.exitCode = 1;
  }
}

main();
