import { chromium } from "playwright";
import fs from 'fs';

let browser;

const cleanupFunctions = `
async function waitForDynamicContent() {
  return new Promise(resolve => {
    const observer = new MutationObserver((mutations, obs) => {
      if (document.body && document.body.innerHTML.length > 0) {
        obs.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(); }, 5000);
  });
}

function removePopups() {
  const selectors = [
    '.popup', '.modal', '.overlay', '[class*="popup"]', 
    '[class*="modal"]', '[id*="popup"]', '[id*="modal"]', 
    '[style*="position:fixed"]', '[style*="position: fixed"]'
  ];
  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => el.remove());
  });
}

function removeInfiniteScroll() {
  window.onscroll = null;
  document.onscroll = null;
  window.removeEventListener('scroll', window.onscroll);
  document.querySelectorAll('[data-infinite-scroll], [class*="infinite-scroll"]').forEach(el => el.remove());
}

function stopAnimations() {
  const style = document.createElement('style');
  style.textContent = '* { animation: none !important; transition: none !important; }';
  document.head.appendChild(style);
}

function removeScripts() {
  document.querySelectorAll('script:not([type="application/ld+json"])').forEach(script => script.remove());
}

async function cleanupPage() {
  await waitForDynamicContent();
  removePopups();
  removeInfiniteScroll();
  stopAnimations();
  removeScripts();
}
`;

async function autoScroll(page) {
  await page.evaluate(async () => {
      await new Promise((resolve) => {
          // Get the height of the viewport
          const viewportHeight = window.innerHeight;

          // Scroll down by the height of the viewport
          window.scrollBy(0, viewportHeight);

          // Give some time to load new content, if any
          setTimeout(resolve, 1000); // wait 1 second for content to load
      });
  });
}

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

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });

    await autoScroll(page);

    await page.evaluate(() => {
      window.stop();
    });

    const article = await page.evaluate(async ({ clean }) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none'; // Hide the iframe
      document.body.appendChild(iframe);

      const iframeWindow = iframe.contentWindow;
      const iframeDoc = iframe.contentDocument || iframeWindow.document;

      iframeDoc.open();
      iframeDoc.write('<!DOCTYPE html><html><head></head><body></body></html>');
      iframeDoc.close();

      iframeDoc.body.innerHTML = document.body.innerHTML;

      iframeWindow.Image = function () { };
      iframeWindow.fetch = function () { };
      iframeWindow.XMLHttpRequest = function () { };

      iframeWindow.eval(clean);
      await iframeWindow.cleanupPage(); // Call the cleanup function

      const content = iframeDoc.body.textContent;

      iframe.parentNode.removeChild(iframe);

      return content;
    }, { clean: cleanupFunctions }); // Pass the cleanup functions

    return article; // Return the extracted content
  } catch (err) {
    console.error("An error occurred:", err);
    return null;
  } finally {
    if (page) {
      await page.close(); // Close the page after use
    }
  }
}

const url = "https://www.scmp.com/news/china/science/article/3281598/chinas-father-quantum-says-global-secure-communications-just-3-years-away?module=top_story&pgtype=homepage";

(async () => {
  await initializeBrowser(); // Initialize the browser
  const result = await openOneTab(url); // Open the tab and get the content

  if (result) {
    console.log("Content:", result);
  } else {
    console.log("Failed to extract the article.");
  }

  await browser.close(); // Close the browser after work is done
})();
