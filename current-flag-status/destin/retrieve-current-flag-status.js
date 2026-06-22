const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function getDetailedFlagDescription(flag_status) {
    flag_status = flag_status.toLowerCase();
    let flag_status_description = "";

    if (flag_status.includes("closed") || flag_status.includes("double red")) {
        flag_status_description = "double red. The water is closed to the public";
    } else if (flag_status.includes("strong") || flag_status.includes("red")) {
        flag_status_description = "red. This color indicates strong surf and/or currents, and you should not enter the water above knee level";
    } else if (flag_status.includes("medium") || flag_status.includes("yellow")) {
        flag_status_description = "yellow. This color indicates medium hazard, moderate surf and/or strong currents";
    } else if (flag_status.includes("low") || flag_status.includes("green")) {
        flag_status_description = "green. This color indicates generally low hazard with calm conditions";
    } else {
        return "Could not determine current flag status from the latest post.";
    }
    
    if (flag_status.includes("marine") || flag_status.includes("purple")) {
        flag_status_description += ". Purple flags are also flying on the beach, indicating dangerous marine life such as jellyfish are present";
    }
    
    return `The beach safety flags in Destin are ${flag_status_description}.`;
}

async function getFlagStatus() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to Facebook
    await page.goto('https://www.facebook.com/destinbeachsafety/', { waitUntil: 'domcontentloaded' });
    
    // Wait for the first post to be visible
    const postLocator = page.locator('div[role="article"]').first();
    await postLocator.waitFor({ state: 'visible', timeout: 10000 });
    
    const postContent = await postLocator.innerText();
    const result = await getDetailedFlagDescription(postContent);
    
    console.log(result);
    
    // Write to file
    const outputFilePath = path.join(__dirname, '..', '..', 'flag-status', 'destin.txt');
    fs.writeFileSync(outputFilePath, result);
    
  } catch (error) {
    console.error("Scraping failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

getFlagStatus();