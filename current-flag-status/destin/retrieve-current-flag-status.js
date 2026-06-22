const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function getFlagDescription(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const dom = new JSDOM(response.data);
    const document = dom.window.document;
    
    // Look for flag status in common Facebook post patterns
    const postText = document.body.textContent.toLowerCase();
    
    let flagStatusDescription = '';
    
    if (postText.includes('double red') || postText.includes('water closed')) {
      flagStatusDescription = 'double red. The water is closed to the public.';
    } else if (postText.includes('red flag')) {
      flagStatusDescription = 'red. This color indicates strong surf and/or currents, and you should not enter the water above knee level.';
    } else if (postText.includes('yellow flag')) {
      flagStatusDescription = 'yellow. This color indicates medium hazard, moderate surf and/or strong currents.';
    } else if (postText.includes('green flag')) {
      flagStatusDescription = 'green. This color indicates generally low hazard with calm conditions.';
    }
    
    // Check for marine life warnings (purple flag)
    if (postText.includes('marine life') || postText.includes('jellyfish') || postText.includes('purple flag')) {
      flagStatusDescription += ' Purple flags are also flying on the beach, indicating dangerous marine life such as jellyfish are present.';
    }
    
    if (!flagStatusDescription) {
      throw new Error('The script could not determine the current flag color from the retrieved text.');
    }
    
    return `The beach safety flags in Destin are ${flagStatusDescription}`;
  } catch (error) {
    throw new Error(`Failed to retrieve flag status: ${error.message}`);
  }
}

async function main() {
  const url = 'https://www.facebook.com/destinbeachsafety/';
  
  try {
    const result = await getFlagDescription(url);
    console.log(result);
    
    const outputFilePath = path.join(__dirname, '..', '..', 'flag-status', 'destin.txt');
    fs.writeFile(outputFilePath, result, (err) => {
      if (err) {
        console.error(err);
        process.exitCode = 1;
      } else {
        console.log('The flag status has been saved to the file:', outputFilePath);
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  }
}

main();
