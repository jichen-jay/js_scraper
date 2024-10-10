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

const extractionLogic = `
function extractDiscussionThreads() {
  function isVisible(el) {
    const style = window.getComputedStyle(el);
    return (
      style &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      el.offsetWidth > 0 &&
      el.offsetHeight > 0
    );
  }

  function getTextContentLength(el) {
    return el.innerText ? el.innerText.trim().length : 0;
  }

  function findDiscussionContainer() {
    const bodyElements = Array.from(document.body.getElementsByTagName('*')).filter(isVisible);

    const candidates = bodyElements.map(el => {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const textLength = getTextContentLength(el);
      const childElementCounts = el.querySelectorAll('*').length;

      const score = area * 0.5 + textLength * 2 + childElementCounts * 10;

      return { element: el, score: score };
    });

    candidates.sort((a, b) => b.score - a.score);

    for (let i = 0; i < Math.min(10, candidates.length); i++) {
      const el = candidates[i].element;

      const childElements = Array.from(el.children).filter(isVisible);
      let textHeavyChildren = 0;
      for (let child of childElements) {
        const childTextLength = getTextContentLength(child);
        if (childTextLength > 50) { // Arbitrary threshold for significant text content
          textHeavyChildren++;
        }
      }

      if (textHeavyChildren > 5) { // If there are more than 5 text-heavy child elements
        return el;
      }
    }

    return null;
  }

  function extractComments(element, depth = 0) {
    const comments = [];
    const MAX_DEPTH = 10; // Limit recursion depth to prevent infinite loops

    if (depth > MAX_DEPTH) {
      return comments;
    }

    const childNodes = Array.from(element.childNodes).filter(isVisible);

    for (let node of childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        continue; // Skip text nodes directly under the parent
      }

      const textContent = node.innerText ? node.innerText.trim() : '';
      const textLength = textContent.length;

      if (textLength > 50 && textLength < 1000) {
        const childComments = extractComments(node, depth + 1);
        comments.push({
          content: textContent,
          replies: childComments
        });
      } else {
        // Recurse into child elements to find comments
        const childComments = extractComments(node, depth + 1);
        if (childComments.length > 0) {
          comments.push(...childComments);
        }
      }
    }

    return comments;
  }

  const discussionContainer = findDiscussionContainer();

  if (!discussionContainer) {
    throw new Error("Couldn't find the discussion container.");
  }

  const threads = extractComments(discussionContainer);

  return threads;
}
`;



async function initializeBrowser() {
    try {
        var agent = "Mozilla/5.0 (Windows NT 5.1; rv:31.0) Gecko/20100101 Firefox/31.0";
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-extensions',
                `--user-agent=${agent}`,
                '--window-size=768,1024',
                '--force-device-scale-factor=1',
                '--disk-cache-dir=/dev/shm/chrome-cache',
            ]
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

        await page.evaluate(() => {
            window.stop();
        });

        const result = await page.evaluate(async ({ clean, extract }) => {
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

            iframeWindow.eval(extract); // Evaluate the extraction logic

            let extractedComments = [];
            if (typeof iframeWindow.extractDiscussionThreads === 'function') {
                extractedComments = iframeWindow.extractDiscussionThreads();
            } else {
                throw new Error('extractDiscussionThreads function is not available.');
            }

            iframe.parentNode.removeChild(iframe);

            return { comments: extractedComments };
        }, { clean: cleanupFunctions, extract: extractionLogic });

        return result; // Return the parsed article and comments
    } catch (err) {
        console.error("An error occurred:", err);
        return null;
    } finally {
        if (page) {
            await page.close(); // Close the page after use
        }
    }
}


var url = "https://old.reddit.com/r/debian/comments/1dcuqm/getting_rocm_installed_on_debian_12/"; 
(async () => {
    await initializeBrowser();
    const result = await openOneTab(url);

    if (result) {
        console.log("Extracted Comments:", JSON.stringify(result, null, 2));
    } else {
        console.log("Failed to extract comments.");
    }

    await browser.close();
})();
