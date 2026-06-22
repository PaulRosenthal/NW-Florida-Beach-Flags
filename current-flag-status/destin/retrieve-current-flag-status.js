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
    const browser = await chromium.launch({ headless: true });
    
    // We use a mobile-optimized context
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        viewport: { width: 390, height: 844 },
    });

    const page = await context.newPage();
    
    try {
        console.log("Navigating to Mobile Facebook...");
        // Use the mobile site URL
        await page.goto('https://m.facebook.com/destinbeachsafety/', { waitUntil: 'domcontentloaded' });
        
        // Wait for the article element (m.facebook uses standard <article> tags)
        const postLocator = page.locator('article').first();
        await postLocator.waitFor({ state: 'visible', timeout: 20000 });
        
        const postContent = await postLocator.innerText();
        
        console.log("--- DEBUG: Raw post content ---");
        console.log(postContent);
        console.log("-------------------------------");
        
        const result = await getDetailedFlagDescription(postContent);
        
        const outputFilePath = path.join(__dirname, '..', '..', 'flag-status', 'destin.txt');
        if (!fs.existsSync(path.dirname(outputFilePath))) {
            fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
        }
        
        fs.writeFileSync(outputFilePath, result);
        console.log("Result saved:", result);
        
    } catch (error) {
        console.error("Scraping failed:", error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

getFlagStatus();
