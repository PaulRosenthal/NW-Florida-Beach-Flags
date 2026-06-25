const { ApifyClient } = require('apify-client');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

/**
 * Helper function to extract text from an image URL using Tesseract OCR
 */
async function extractTextFromImage(imageUrl) {
    try {
        const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng');
        return text;
    } catch (error) {
        console.error(`[OCR Error] Failed to process image (${imageUrl}):`, error.message);
        return '';
    }
}

/**
 * Parses the raw extracted text and converts it into your detailed output text.
 * NOTE: Replace the interior logic here with your existing AI/Parser integration.
 */
async function getDetailedFlagDescription(text) {
    const lower = text.toLowerCase();
    let color = "unknown";
    
    if (lower.includes('double red')) color = "double red";
    else if (lower.includes('red')) color = "red";
    else if (lower.includes('yellow')) color = "yellow";
    else if (lower.includes('green')) color = "green";
    else if (lower.includes('purple')) color = "purple";

    // Example return structures matching your project requirements
    if (color === "red") {
        return "The beach safety flags in Destin are red. This color indicates strong surf and/or currents, and you should not enter the water above knee level.";
    } else if (color === "yellow") {
        return "The beach safety flags in Destin are yellow. This color indicates medium hazard with moderate surf and/or currents. Always swim near a lifeguard.";
    }
    
    return `Beach safety update text detected: ${text}`;
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

        let selectedText = "";

        // Loop through posts chronologically: Newest (Index 0) to Oldest (Index 2)
        for (const item of items) {
            const postText = item.text || item.message || '';
            let ocrText = '';

            // Find image attachment pathing from the payload variations
            const imageUrl = item.mediaUrl || 
                             (item.images && item.images[0]) || 
                             (item.attachments && item.attachments[0]?.media?.image?.src);

            if (imageUrl) {
                console.log(`Running OCR on post image: ${imageUrl}`);
                ocrText = await extractTextFromImage(imageUrl);
            }

            // Combine both sources so layout gaps don't cause order-of-operation errors
            const combinedContent = `${postText}\n${ocrText}`.trim();
            const lowerCombined = combinedContent.toLowerCase();

            // If this post contains any flag signature context, lock onto it
            if (lowerCombined.includes('flag') || lowerCombined.includes('closed') || lowerCombined.includes('surf')) {
                console.log("Found matching flag updates in this post block.");
                selectedText = combinedContent;
                break; // Escape the loop instantly: we have our newest target data
            }

            console.log("Post did not contain flag updates. Checking older post...");
        }

        // Ultimate structural safety fallback
        if (!selectedText) {
            console.log("Warning: No recent posts matched flag keywords. Falling back to newest post text.");
            selectedText = items[0].text || items[0].message || '';
        }
        
        console.log("--- DEBUG: Final Text Selected for Processing ---");
        console.log(selectedText);
        console.log("-------------------------------------------------");

        // Generate the finalized asset report string
        const result = await getDetailedFlagDescription(selectedText);
        
        // Map target location matching your repo architecture
        const outputFilePath = path.join(__dirname, '..', '..', 'flag-status', 'destin.txt');
        if (!fs.existsSync(path.dirname(outputFilePath))) {
            fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
        }
        
        fs.writeFileSync(outputFilePath, result);
        console.log("File saved successfully with parsed status:", result);

    } catch (error) {
        console.error("Failed to retrieve flag status:");
        console.error(error.message);
        process.exit(1);
    }
}

// Fire script execution
getFlagStatus();
