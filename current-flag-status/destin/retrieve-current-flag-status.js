const { ApifyClient } = require('apify-client');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

/**
 * Helper function to download an image and extract text via Tesseract OCR
 */
async function extractTextFromImage(imageUrl) {
    try {
        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch image asset. Status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
        console.log(`[OCR Debug] Raw text extracted: "${text.replace(/\n/g, ' ').trim()}"`);
        return text;
    } catch (error) {
        console.error(`[OCR Error] Failed to process image (${imageUrl}):`, error.message);
        return '';
    }
}

/**
 * Parses the raw extracted text and converts it into your detailed output text.
 */
async function getDetailedFlagDescription(flag_status) {
    const text = flag_status.toLowerCase();
    let description = "the current flag status could not be determined from the latest post.";
    
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

        let selectedText = "";

        // Loop through posts chronologically: Newest (Index 0) to Oldest (Index 2)
        for (const item of items) {
            const postText = item.text || item.message || '';
            let ocrText = '';

            const imageUrl = item.media?.[0]?.photo_image?.uri || 
                             item.mediaUrl || 
                             (item.images && item.images[0]) || 
                             (item.attachments && item.attachments[0]?.media?.image?.src);

            if (imageUrl) {
                console.log(`Running OCR on post image: ${imageUrl}`);
                ocrText = await extractTextFromImage(imageUrl);
            } else {
                console.log("No image asset detected on this specific post object.");
            }

            // Merge text and image strings to catch layout updates safely
            const combinedContent = `${postText}\n${ocrText}`.trim();
            const lowerCombined = combinedContent.toLowerCase();

            // Broadened validation parameters to include specific color names found by OCR
            if (
                lowerCombined.includes('flag') || 
                lowerCombined.includes('closed') || 
                lowerCombined.includes('surf') ||
                lowerCombined.includes('yellow') ||
                lowerCombined.includes('red') ||
                lowerCombined.includes('green') ||
                lowerCombined.includes('purple')
            ) {
                console.log("Found matching flag updates in this post block.");
                selectedText = combinedContent;
                break; 
            }

            console.log("Post did not contain flag updates. Checking older post...");
        }

        if (!selectedText) {
            console.log("Warning: No recent posts matched flag keywords. Falling back to newest post text.");
            selectedText = items[0].text || items[0].message || '';
        }
        
        console.log("--- DEBUG: Final Text Selected for Processing ---");
        console.log(selectedText);
        console.log("-------------------------------------------------");

        const result = await getDetailedFlagDescription(selectedText);
        
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

getFlagStatus();
