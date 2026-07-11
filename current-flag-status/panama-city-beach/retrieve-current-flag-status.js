const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Add stealth plugin
puppeteer.use(StealthPlugin());

async function getFlagDescription(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set a realistic viewport
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating to page...');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // Debugging: Take a screenshot to see what the bot sees
  await page.screenshot({ path: 'debug-screenshot.png' });
  console.log('Screenshot saved for debugging.');

  // Check if content is in an iframe
  let element;
  const frames = page.frames();
  
  // Try to find the selector in the main page or any frame
  for (const frame of frames) {
    try {
      element = await frame.waitForSelector('.flag-description', { timeout: 10000 });
      if (element) {
        console.log('Found element inside a frame.');
        break;
      }
    } catch (e) {
      // Not in this frame, continue
    }
  }

  if (!element) {
    throw new Error('Could not find .flag-description in main page or any iframes.');
  }

  const statusText = await element.evaluate(el => el.textContent.toLowerCase());
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
    // ... rest of your file writing logic
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
    process.exitCode = 1;
  }
}

main();
