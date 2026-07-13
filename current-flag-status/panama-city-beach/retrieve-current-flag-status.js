const { chromium } = require('playwright');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const URL_TO_FETCH = 'https://www.visitpanamacitybeach.com/stay-pcb-current/';

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

async function getFlagDescription() {
  let browser;
  try {
    console.log('Launching Playwright browser...');
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });

    const page = await context.newPage();
    
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    console.log(`Navigating to ${URL_TO_FETCH}`);
    await page.goto(URL_TO_FETCH, { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });

    const html = await page.content();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    let rawLabel = '';
    const conditionsHeading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, strong, div'))
      .find(el => el.textContent.trim().toLowerCase().startsWith('current beach conditions'));

    if (conditionsHeading) {
      let node = conditionsHeading.nextElementSibling;
      while (node && !node.textContent.trim()) {
        node = node.nextElementSibling;
      }
      if (node) {
        rawLabel = node.textContent.trim();
      }
    }

    if (!rawLabel) {
      const flagImage = Array.from(document.querySelectorAll('img')).find(img => 
        (img.getAttribute('src') || '').includes('_weather_flag_')
      );
      if (flagImage) {
        const src = flagImage.getAttribute('src');
        const match = src.match(/\/([a-z_]+?)_weather_flag_/i);
        if (match) {
          rawLabel = match[1].replace(/_/g, ' ');
        }
      }
    }

    if (!rawLabel) {
      throw new Error('Could not find current flag condition on the page.');
    }

    console.log(`Detected raw label: "${rawLabel}"`);

    const flagStatusDescription = describeFlagColor(rawLabel);
    if (!flagStatusDescription) {
      throw new Error(`Could not map label "${rawLabel}" to a known flag color.`);
    }

    return `The beach safety flags in Panama City Beach are ${flagStatusDescription}`;

  } catch (err) {
    console.error('Error during Playwright scraping:', err.message);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  try {
    const result = await getFlagDescription();
    console.log(result);

    const outputFilePath = path.join(__dirname, '..', '..', 'flag-status', 'panama-city-beach.txt');
    fs.writeFileSync(outputFilePath, result);
    console.log('Flag status saved successfully to:', outputFilePath);
  } catch (err) {
    console.error('Failed to retrieve Panama City Beach flag status:', err.message);
    process.exitCode = 1;
  }
}

main();
