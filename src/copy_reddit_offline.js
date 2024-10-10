import fs from 'fs';
import { JSDOM } from 'jsdom';

function extractDiscussionThreads() {
  const html = fs.readFileSync('assets/reddit.html', 'utf8');
  const dom = new JSDOM(html);
  const { window } = dom;
  const { document } = window;

  function isVisible(el) {
    // We need to adjust isVisible for jsdom
    // It's likely all elements are visible in jsdom
    return true;
  }

  function getTextContentLength(el) {
    return el.textContent ? el.textContent.trim().length : 0;
  }

  // Function to find the discussion container
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

    console.log('Top candidate elements:');
    for (let i = 0; i < Math.min(5, candidates.length); i++) {
      const el = candidates[i].element;
      const score = candidates[i].score;
      console.log(`Candidate ${i + 1}:`);
      console.log(`  Tag: ${el.tagName}`);
      console.log(`  ID: ${el.id}`);
      console.log(`  Class: ${el.className}`);
      console.log(`  Score: ${score}`);
      const textSnippet = el.textContent ? el.textContent.trim().substring(0, 100) : '';
      console.log(`  Text snippet: ${textSnippet.replace(/\s+/g, ' ')}`);
    }

    // Iterate through candidates and find the common ancestor
    for (let i = 0; i < Math.min(10, candidates.length); i++) {
      const el = candidates[i].element;

      const directCommentChildren = el.querySelectorAll('div[data-test-id="comment"]');
      if (directCommentChildren.length > 0) {
        // We've found the first layer that encloses comments
        console.log("Found initial container with comments directly beneath it.  Tag: " + el.tagName + " Class: " + el.className);
        return el; // Found the container
      }

      // Check if this candidate has children that contain comments
      for (let child of el.children ) {
        // If this child has comments
        const directCommentChildren = child.querySelectorAll('div[data-test-id="comment"]');
        if (directCommentChildren.length > 0) {
          // If this child's parent directly encloses text and comments
          if (el.textContent.trim().length > 50) {
            console.log("Selected element as discussion container:");
            console.log(`  Tag: ${el.tagName}`);
            console.log(`  ID: ${el.id}`);
            console.log(`  Class: ${el.className}`);
            return el; // Found container
          }
        }
      }
    }

    return null;
  }
  
  const discussionContainer = findDiscussionContainer();

  if (!discussionContainer) {
    throw new Error("Couldn't find the discussion container.");
  }

  // Find comments
  const commentElements = discussionContainer.querySelectorAll(
    'div[data-test-id="comment"]'
  );

  // Identify top-level comments
  const topLevelComments = commentElements.filter(el => {
    return !el.closest('div[data-test-id="comment"] > div[data-test-id="comment"]');
  });

  // Function to extract comments
  function extractComments(elements, depth = 0) {
    // ... Same as the previous version ...
  }

  const threads = extractComments(topLevelComments);

  return threads;
}

// Call the function and output the result
try {
  const threads = extractDiscussionThreads();
  console.log('Extracted discussion threads:\n', JSON.stringify(threads, null, 2));
  fs.writeFileSync('discussion_threads.json', JSON.stringify(threads, null, 2), 'utf8');
} catch (error) {
  console.error('An error occurred:', error.message);
}


Top candidate elements:
Candidate 1:
  Tag: SHREDDIT-APP
  ID: 
  Class: overflow-visible pt-[var(--page-y-padding)] 
  Score: 36420
  Text snippet: Open menu Open navigation .snoo-cls-1 { fill: url(#snoo-radia
Candidate 2:
  Tag: DIV
  ID: 
  Class: grid-container theme-rpl grid grid-cols-1 m:grid-cols-[272px_1fr]
  Score: 22840
  Text snippet: Go to debian 
Candidate 3:
  Tag: DIV
  ID: 
  Class: subgrid-container m:col-start-2 box-border flex flex-col order-2 w-full m:w-[1120px] m:max-w-[calc(100vw-272px)] xs:px-md mx-auto
  Score: 15480
  Text snippet: Go to debian 
Candidate 4:
  Tag: DIV
  ID: 
  Class: main-container flex gap-md w-full flex-wrap xs:flex-nowrap pb-xl
  Score: 15450
  Text snippet: Go to debian 
Candidate 5:
  Tag: REDDIT-HEADER-LARGE
  ID: 
  Class: nd:visible top-0 left-0 right-0 fixed z-[4] theme-beta
  Score: 10706
  Text snippet: Open menu Open navigation .snoo-cls-1 { fill: url(#snoo-radia
An error occurred: Couldn't find the discussion container.