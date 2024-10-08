import { chromium } from "playwright";
import fs from 'fs';
import path from 'path';

let browser;

async function initializeBrowser() {
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log("Browser launched.");
  } catch (error) {
    console.error("Failed to launch the browser:", error);
    process.exit(1);
  }
}

async function openOneTab(url) {
  const TIMEOUT = 30000; // 30 seconds timeout
  let page;

  try {
    page = await browser.newPage();

    // Navigate to the specified URL
    await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT });

    // Optional: Stop any additional loading if needed
    await page.evaluate(() => {
      window.stop();
    });

    // Read the Readability.js content from a local file
    const readabilityScript = fs.readFileSync('assets/Readability.js', 'utf8');

    // Pass the Readability script content to the page.evaluate function
    const article = await page.evaluate((readabilitySource) => {
      // Create an invisible iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none'; // Hide the iframe
      document.body.appendChild(iframe);

      const iframeWindow = iframe.contentWindow;
      const iframeDoc = iframe.contentDocument || iframeWindow.document;

      // Write the basic HTML structure into the iframe
      iframeDoc.open();
      iframeDoc.write('<!DOCTYPE html><html><head></head><body></body></html>');
      iframeDoc.close();

      // Copy the body content of the original document into the iframe
      iframeDoc.body.innerHTML = document.body.innerHTML;

      // Prevent external resources from loading in the iframe document
      iframeWindow.Image = function() {};
      iframeWindow.fetch = function() {};
      iframeWindow.XMLHttpRequest = function() {};

      // Evaluate the Readability script in the iframe's context
      iframeWindow.eval(readabilitySource);

      // Check if Readability is available
      if (typeof iframeWindow.Readability !== 'undefined') {
        // Use Readability to parse the iframe document
        const reader = new iframeWindow.Readability(iframeDoc, {
          nbTopCandidates: 30,
          charThreshold: 50,
          keepClasses: true
        });
        const parsed = reader.parse();

        // Remove the iframe from the document
        iframe.parentNode.removeChild(iframe);

        return parsed;
      } else {
        throw new Error('Readability is not available in the iframe document.');
      }
    }, readabilityScript);

    return article; // Return the parsed article
  } catch (err) {
    console.error("An error occurred:", err);
    return null;
  } finally {
    if (page) {
      await page.close(); // Close the page after use
    }
  }
}

const url = "https://agriculture.canada.ca/en/sector/animal-industry/red-meat-and-livestock-market-information/prices"; // Change as needed

(async () => {
  await initializeBrowser(); // Initialize the browser
  const result = await openOneTab(url); // Open the tab and get the content

  if (result) {
    console.log("Title:", result.title);
    console.log("Content:", result.content);
  } else {
    console.log("Failed to extract the article.");
  }

  await browser.close(); // Close the browser after work is done
})();
