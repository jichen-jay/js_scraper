import { chromium } from "playwright";
import fs from 'fs';

let browser;

async function cleanupPage() {

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

  removePopups();
  removeInfiniteScroll();
  stopAnimations();
  removeScripts();
}

const cleanupFunctions = cleanupPage.toString();

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
    return el.textContent ? el.textContent.trim().length : 0;
  }

  function containsCommentKeyword(el) {
    const className = el.className || '';
    const id = el.id || '';
    const classAndId = `${className} ${id}`.toLowerCase();
    return classAndId.includes('comment');
  }

  function findDiscussionContainer() {
    const bodyElements = Array.from(document.body.getElementsByTagName('*')).filter(isVisible);

    const candidates = bodyElements.map(el => {
      const textLength = getTextContentLength(el);
      const immediateChildren = Array.from(el.children);

      const immediateChildCount = immediateChildren.length;

      const numberOfCommentChildren = immediateChildren.filter(child => {
        return containsCommentKeyword(child) && isVisible(child) && getTextContentLength(child) > 0;
      }).length;

      const score =
        textLength * 1 +
        immediateChildCount * 10 +
        numberOfCommentChildren * 100;

      return { element: el, score: score };
    });

    if (candidates.length === 0) {
      console.error("No candidate elements found.");
      throw new Error("Couldn't find the discussion container.");
    }

    candidates.sort((a, b) => b.score - a.score);

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i].element;

      const commentChildren = Array.from(el.children).filter(child => {
        return containsCommentKeyword(child) && isVisible(child) && getTextContentLength(child) > 0;
      });

      if (commentChildren.length > 0 && getTextContentLength(el) > 0) {
        console.log("Found container with immediate comment-like children.");
        console.log(`  Tag: ${el.tagName}`);
        console.log(`  ID: ${el.id}`);
        console.log(`  Class: ${el.className}`);
        return el;
      }
    }

    console.log("Using highest scoring element as discussion container.");
    const el = candidates[0].element;
    console.log(`  Tag: ${el.tagName}`);
    console.log(`  ID: ${el.id}`);
    console.log(`  Class: ${el.className}`);
    return el;
  }

  const discussionContainer = findDiscussionContainer();

  if (!discussionContainer) {
    throw new Error("Couldn't find the discussion container.");
  }

  const discussionText = discussionContainer.innerText.trim();

  return discussionText;
}

const extractionLogic = extractDiscussionThreads.toString();

async function initializeBrowser() {
  try {
    var agent = "Mozilla/5.0 (Windows NT 5.1; rv:31.0) Gecko/20100101 Firefox/31.0";
    browser = await chromium.launch({
      headless: false,
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

    page.on('console', msg => {
      console.log(`[PAGE] ${msg.text()}`);
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });

    const result = await page.evaluate(async ({ clean, extract }) => {
      if (clean) {
        eval(clean);
        if (typeof cleanupPage === 'function') {
          await cleanupPage();
        }
      }

      eval(extract);

      if (typeof extractDiscussionThreads === 'function') {
        const extractedData = extractDiscussionThreads();
        return extractedData;
      } else {
        throw new Error('extractDiscussionThreads function is not available.');
      }
    }, { clean: cleanupFunctions, extract: extractionLogic });

    return { comments: result }; // Return the extracted discussion text
  } catch (err) {
    console.error("An error occurred:", err);
    return null;
  } finally {
    if (page) {
      await page.close(); // Close the page after use
    }
  }
}

var url = "https://www.reddit.com/r/LocalLLaMA/comments/1g0jehn/ive_been_working_on_this_for_6_months_free_easy/";
var url = "https://huaren.us/showtopic.html?topicid=3053496";
var url = "https://newmitbbs.com/viewtopic.php?f=18&t=608671&sid=3e44eab4cb1d52f567a2f4a257a2dab5";

(async () => {
  await initializeBrowser();
  const result = await openOneTab(url);

  if (result) {
    console.log("Extracted Comments:", result.comments);

    fs.writeFileSync('discussion_text.txt', result.comments, 'utf8');
  } else {
    console.log("Failed to extract comments.");
  }

  await browser.close();
})();
