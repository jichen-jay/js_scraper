// Priority 1: Ensure dynamic content is loaded
async function waitForDynamicContent() {
    return new Promise(resolve => {
      const observer = new MutationObserver((mutations, obs) => {
        if (document.body && document.body.innerHTML.length > 0) {
          obs.disconnect();
          resolve();
        }
      });
  
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
  
      // Timeout after 5 seconds to prevent waiting indefinitely
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 5000);
    });
  }
  
  // Priority 2: Expand all collapsed or hidden content
  function expandCollapsedContent() {
    // Expand elements with aria-expanded attribute
    document.querySelectorAll('[aria-expanded="false"]').forEach(el => {
      el.setAttribute('aria-expanded', 'true');
    });
  
    // Click on "Read more" or similar buttons
    const expandTexts = ['more', 'expand', 'read more', 'show more'];
    document.querySelectorAll('a, button, span').forEach(el => {
      if (expandTexts.some(text => el.innerText.toLowerCase().includes(text))) {
        el.click();
      }
    });
  }
  
  // Priority 3: Remove pop-ups and overlays
  function removePopups() {
    const selectors = [
      '.popup', '.modal', '.overlay', '[class*="popup"]', '[class*="modal"]',
      '[id*="popup"]', '[id*="modal"]', '[style*="position:fixed"]',
      '[style*="position: fixed"]'
    ];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => el.remove());
    });
  }
  
  // Priority 4: Remove infinite scroll and lazy loading scripts
  function removeInfiniteScroll() {
    window.onscroll = null;
    document.onscroll = null;
    window.removeEventListener('scroll', window.onscroll);
    document.querySelectorAll('[data-infinite-scroll], [class*="infinite-scroll"]').forEach(el => el.remove());
  }
  
  // Priority 5: Stop animations and transitions
  function stopAnimations() {
    const style = document.createElement('style');
    style.textContent = '* { animation: none !important; transition: none !important; }';
    document.head.appendChild(style);
  }
  
  // Priority 6: Remove iframes
  function removeIframes() {
    document.querySelectorAll('iframe').forEach(iframe => iframe.remove());
  }
  
  // Priority 7: Remove unnecessary scripts (excluding JSON-LD scripts)
  function removeScripts() {
    document.querySelectorAll('script:not([type="application/ld+json"])').forEach(script => script.remove());
  }
  
  // Priority 8: Clean up the DOM by removing unwanted elements
  function cleanupDOM() {
    const elementsToRemove = [
      'noscript', 'embed', 'object', 'audio', 'video', 'canvas', 'svg', 'aside', 'footer', 'header', 'nav', 'form', 'input', 'button'
    ];
    elementsToRemove.forEach(tag => {
      document.querySelectorAll(tag).forEach(el => el.remove());
    });
    // Remove elements with negative impacts on readability
    const unwantedSelectors = [
      '.advertisement', '.ads', '.social-share', '.cookie-consent', '.newsletter-signup',
      '[class*="ad-"]', '[id*="ad-"]', '[class*="banner"]', '[id*="banner"]'
    ];
    unwantedSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => el.remove());
    });
  }
  
  // Priority 9: Disable all JavaScript event listeners
  function disableEventListeners() {
    const oldAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function() {};
    // Remove inline event handlers
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      el.onclick = null;
      el.onmouseover = null;
      el.onmouseout = null;
      el.onmouseenter = null;
      el.onmouseleave = null;
    });
  }
  
  // Combined cleanup function
  async function cleanupPage() {
    await waitForDynamicContent();
    expandCollapsedContent();
    removePopups();
    removeInfiniteScroll();
    stopAnimations();
    removeIframes();
    removeScripts();
    cleanupDOM();
    disableEventListeners();
  }
  