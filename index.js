import { chromium } from "playwright";
import fs from 'fs';

let browser;

async function initializeBrowser() {
  try {
    browser = await chromium.launch({
      headless: true, // Set to false to see the UI, true for headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Additional arguments, if needed
    });
    console.log("Browser launched.");
  } catch (error) {
    console.error("Failed to connect to the browser:", error);
    process.exit(1);
  }
}
async function openOneTab(url) {
    const TIMEOUT = 30000; // 12 seconds timeout
    let page;
  
    try {
      page = await browser.newPage();
 
      await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js' });     

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
      } catch (error) {
        if (error.name === "TimeoutError") {
          console.warn(`Navigation timeout for ${url}.`);
        } else {
          throw error;
        }
      }

      await page.waitForFunction(() => typeof Readability !== 'undefined');

      const article = await page.evaluate(() => {
        window.stop(); // Stop loading if needed
        const documentClone = document.cloneNode(true);
        const reader = new Readability(documentClone, {
            nbTopCandidates: 30,
            charThreshold: 50,
            keepClasses: true
        });
        return reader.parse();
      });
        
      return article; // Return the parsed article
    } catch (err) {
      console.error("An error occurred:", err);
      return null; // Return null in case of an error
    } finally {
      if (page) {
        await page.close(); // Close the page after use
      }
    }
  }

// const url = "https://agriculture.canada.ca/en/sector/animal-industry/red-meat-and-livestock-market-information/prices";
const url = "http://example.com/";

(async () => {
  await initializeBrowser();
  const result = await openOneTab(url);
  console.log(result);
  
  await browser.close();
})();
