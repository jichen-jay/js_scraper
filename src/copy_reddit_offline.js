import fs from 'fs';
import { JSDOM } from 'jsdom';

function extractDiscussionContent() {
  const html = fs.readFileSync('assets/reddit.html', 'utf8');
  const dom = new JSDOM(html);
  const { window } = dom;
  const { document } = window;

  function isVisible(el) {
    // Implement visibility checks if needed
    return true; // For simplicity, we assume all elements are visible
  }

  function getTextContentLength(el) {
    return el.textContent ? el.textContent.trim().length : 0;
  }

  function findDiscussionContainer() {
    const bodyElements = Array.from(document.body.getElementsByTagName('*')).filter(isVisible);

    const candidates = bodyElements.map(el => {
      const textLength = getTextContentLength(el);
      const immediateChildCount = el.children.length;

      // Number of direct child elements that are comments
      const numberOfCommentChildren = Array.from(el.children).filter(child =>
        child.matches('div[data-test-id="comment"]')
      ).length;

      // Adjust the weights as needed
      const score = textLength * 1 + immediateChildCount * 10 + numberOfCommentChildren * 100;

      return { element: el, score: score };
    });

    candidates.sort((a, b) => b.score - a.score);

    console.log('Top candidate elements:');
    for (let i = 0; i < Math.min(5, candidates.length); i++) {
      const el = candidates[i].element;
      const score = candidates[i].score.toFixed(2);

      console.log(`Candidate ${i + 1}:`);
      console.log(`  Tag: ${el.tagName}`);
      console.log(`  ID: ${el.id}`);
      console.log(`  Class: ${el.className}`);
      console.log(`  Score: ${score}`);
      const textSnippet = el.textContent ? el.textContent.trim().substring(0, 100) : '';
      console.log(`  Text snippet: ${textSnippet.replace(/\s+/g, ' ')}`);
    }

    // Now, find the container with immediate child comments
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i].element;

      const numberOfCommentChildren = Array.from(el.children).filter(child =>
        child.matches('div[data-test-id="comment"]')
      ).length;

      if (numberOfCommentChildren > 0) {
        console.log("Found container with immediate comment children.");
        console.log(`  Tag: ${el.tagName}`);
        console.log(`  ID: ${el.id}`);
        console.log(`  Class: ${el.className}`);
        return el;
      }
    }

    // If none are found, use the highest scoring element
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

  // Once the container is found, extract all visible text within it
  const discussionText = discussionContainer.textContent.trim();

  console.log('Extracted discussion text:\n', discussionText);

  fs.writeFileSync('discussion_text.txt', discussionText, 'utf8');

  return discussionText;
}

// Execute the function
try {
  const discussionText = extractDiscussionContent();
  // The output is already displayed in the function
} catch (error) {
  console.error('An error occurred:', error.message);
}
