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
function removeElementsByAttribute(attributeName, attributeValue) {
  document.querySelectorAll('[' + attributeName + '="' + attributeValue + '"]')
    .forEach(el => {
      el.remove();
    });
}

function removeElementAndReplaceWithText(selector) {
  document.querySelectorAll(selector).forEach(el => {
    el.replaceWith(el.textContent);
  });
}

function getBoundingClientRect(element) {
  return element.getBoundingClientRect();
}

function isElementInsideContainer(element, container) {
  const elementRect = getBoundingClientRect(element);
  const containerRect = getBoundingClientRect(container);

  return (
    elementRect.left >= containerRect.left &&
    elementRect.right <= containerRect.right &&
    elementRect.top >= containerRect.top &&
    elementRect.bottom <= containerRect.bottom
  );
}

function findDiscussionThreads(container) {
  const threads = [];
  const comments = container.querySelectorAll('*'); 
  comments.forEach(comment => {
    if (
      comment.querySelector('.comment-content') 
    ) {
      if (isElementInsideContainer(comment, container)) {
        threads.push(comment);
      }
    }
  });

  return threads;
}

function extractComments(thread) {
  // Implement your logic to extract comments from each thread
  // For example:
  const commentContent = thread.querySelector('.comment-content').innerText;
  return commentContent;
}

function extractDiscussionThreads() {
  let discussionContainer = document.querySelector("#main-content");

  if (discussionContainer) {
    const threads = findDiscussionThreads(discussionContainer);

    const extractedComments = threads.map(thread => extractComments(thread));
    return extractedComments;
  } else {
    throw new Error("Couldn't find the main discussion container.");
  }
}
`;

async function initializeBrowser() {
  try {
    var agent = "Mozilla/5.0 (Windows NT 5.1; rv:31.0) Gecko/20100101 Firefox/31.0";
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox',
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

    const readabilityScript = fs.readFileSync('./assets/Readability.js', 'utf8');

    const result = await page.evaluate(async ({ read, clean, extract }) => {
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

      iframeWindow.eval(read); // Evaluate the readability script

      iframeWindow.eval(extract); // Evaluate the extraction logic

      // Parse the article using Readability
      let parsedArticle = null;
      if (typeof iframeWindow.Readability !== 'undefined') {
        const reader = new iframeWindow.Readability(iframeDoc, {
          nbTopCandidates: 30,
          charThreshold: 50,
          keepClasses: true
        });
        parsedArticle = reader.parse();
      } else {
        throw new Error('Readability is not available in the iframe document.');
      }

      // Extract comments
      let extractedComments = [];
      if (typeof iframeWindow.extractDiscussionThreads === 'function') {
        extractedComments = iframeWindow.extractDiscussionThreads();
      } else {
        throw new Error('extractDiscussionThreads function is not available.');
      }

      iframe.parentNode.removeChild(iframe);

      return { article: parsedArticle, comments: extractedComments };
    }, { read: readabilityScript, clean: cleanupFunctions, extract: extractionLogic });

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

var url = "https://www.reddit.com/r/debian/comments/1dcuqma/getting_rocm_installed_on_debian_12/";
(async () => {
  await initializeBrowser();
  const result = await openOneTab(url);

  if (result) {
    console.log("Extracted Article:", result.article);
    console.log("Extracted Comments:", result.comments);
  } else {
    console.log("Failed to extract content.");
  }

  await browser.close();
})();
