import { chromium } from "playwright";

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

    // Navigate to the specified URL first
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });

    // Stop any additional loading if needed
    await page.evaluate(() => {
      window.stop();
    });

    // Inject the Readability script after the page has loaded
    // await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js' });
    await page.addScriptTag({ path: 'assets/Readability.js', });

    // Wait for Readability to be defined in the page context
    await page.waitForFunction(() => typeof Readability !== 'undefined', { timeout: TIMEOUT });

    // Extract the article content using Readability
    const article = await page.evaluate(() => {
      const reader = new Readability(document.cloneNode(true), {
        nbTopCandidates: 30,
        charThreshold: 50,
        keepClasses: true
      });
      return reader.parse(); // Return the parsed article
    });

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

const url = "https://news.google.ca/"; // Change as needed

// const url = "https://agriculture.canada.ca/en/sector/animal-industry/red-meat-and-livestock-market-information/prices"; // Change as needed

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
