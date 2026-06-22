const { ApifyClient } = require('apify-client');
const fs = require('fs');
const path = require('path');

async function getDetailedFlagDescription(flag_status) {
    const text = flag_status.toLowerCase();
    let description = "the current flag status could not be determined from the latest post.";
    
    // Explicitly prioritizing "closed" or "double red" strings
    if (text.includes("double red") || text.includes("water closed") || text.includes("closed")) {
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
    const API_TOKEN = process.env.APIFY_TOKEN;

    if (!API_TOKEN) {
        console.error("Error: APIFY_TOKEN environment variable is missing.");
        process.exit(1);
    }

    const client = new ApifyClient({ token: API_TOKEN });

    try {
        console.log("Triggering Apify Facebook Scraper...");
        
        const input = {
            startUrls: [{ url: "https://www.facebook.com/destinbeachsafety/" }],
            resultsLimit: 3 
        };

        const run = await client.actor("apify/facebook-posts-scraper").call(input);
        console.log(`Apify run finished. Fetching results...`);

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        if (!items || items.length === 0) {
            throw new Error("Apify returned no posts.");
        }

        // Search the 3 retrieved items for a post that mentions "flag" OR "closed"
        const actualFlagPost = items.find(item => {
            const content = (item.text || item.message || '').toLowerCase();
            return content.includes('flag') || content.includes('closed');
        });

        // Fall back to the very first post if neither keyword was found
        const targetPost = actualFlagPost || items[0];
        const postText = targetPost.text || targetPost.message || '';
        
        console.log("--- DEBUG: Selected Post Text ---");
        console.log(postText);
        console.log("----------------------------------");

        const result = await getDetailedFlagDescription(postText);
        
        const outputFilePath = path.join(__dirname, '..', '..', 'flag-status', 'destin.txt');
        if (!fs.existsSync(path.dirname(outputFilePath))) {
            fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
        }
        
        fs.writeFileSync(outputFilePath, result);
        console.log("File saved successfully with parsed status:", result);

    } catch (error) {
        console.error("Failed to retrieve flag status via Apify:");
        console.error(error.message);
        process.exit(1);
    }
}

getFlagStatus();
