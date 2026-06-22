const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function getDetailedFlagDescription(flag_status) {
    const text = flag_status.toLowerCase();
    let description = "the current flag status could not be determined from the latest post.";
    
    if (text.includes("double red") || text.includes("water closed")) {
        description = "double red. The water is closed to the public";
    } else if (text.includes("red")) {
        description = "red. This color indicates strong surf and/or currents, and you should not enter the water above knee level";
    } else if (text.includes("yellow")) {
        description = "yellow. This color indicates medium hazard, moderate surf and/or strong currents";
    } else if (text.includes("green")) {
        description = "green. This color indicates generally low hazard with calm conditions";
    }

    if (text.includes("marine") || text.includes("jellyfish") || text.includes("purple")) {
        description += ". Purple flags are also flying on the beach, indicating dangerous marine life such as jellyfish are present";
    }

    return `The beach safety flags in Destin are ${description}.`;
}

async function getFlagStatus() {
    // 1. Launch with realistic options
    const browser = await chromium.launch({ headless: true });
    
    // 2. Emulate a standard mobile device, which often has less aggressive bot detection
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        locale: 'en-US',
        timezoneId: 'America/Chicago'
    });

    const page = await context.newPage();
    
    try {
        console.log("Navigating to Facebook...");
        await page.goto('https://www.facebook.com/destinbeachsafety/', { waitUntil: 'domcontentloaded' });
        
        // Wait for page to settle and simulate "reading" time
        await page.waitForTimeout(6000); 
        
        // Try a broader selector in case the feed structure varies
        const postLocator = page.locator('div[role="article"]').first();
        await postLocator.waitFor({ state: 'visible', timeout: 20000 });
        
        const postContent = await postLocator.innerText();
        
        console.log("--- DEBUG: Raw post content ---");
        console.log(postContent);
        console.log("-------------------------------");
        
        if (!postContent || postContent.trim().length < 5) {
            throw new Error("Empty post content detected.");
        }

        const result = await getDetailedFlagDescription(postContent);
        
        const outputFilePath = path.join(__dirname, '..', '..', 'flag-status', 'destin.txt');
        fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
        fs.writeFileSync(outputFilePath, result);
        
        console.log("File saved successfully.");
        
    } catch (error) {
        console.error("Scraping failed:", error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

getFlagStatus();
