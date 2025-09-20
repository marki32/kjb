// This script is injected into the page to analyze the DOM and perform actions.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDOM') {
    // ... (existing getDOM logic)
    const interactiveElements = [];
    const query = 'input, textarea, button, a, [role="button"], [role="link"]';
    document.querySelectorAll(query).forEach(el => {
      const elementInfo = {
        tag: el.tagName.toLowerCase(),
        attributes: {},
        text: el.innerText || el.value || '',
      };
      ['id', 'class', 'name', 'placeholder', 'aria-label', 'href', 'type', 'role'].forEach(attr => {
        if (el.hasAttribute(attr)) elementInfo.attributes[attr] = el.getAttribute(attr);
      });
      if (isElementVisible(el)) interactiveElements.push(elementInfo);
    });
    sendResponse({ dom: interactiveElements });

  } else if (request.action === 'executeAction') {
    const { command, args } = request;
    const targetElementInfo = args[0];
    const element = findElement(targetElementInfo);

    if (element) {
      highlightElement(element);
      if (command === 'CLICK') {
        element.click();
        sendResponse({ status: 'Success' });
      } else if (command === 'TYPE') {
        const textToType = args[1];
        element.value = textToType;
        // Dispatch events to ensure frameworks like React detect the change
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        sendResponse({ status: 'Success' });
      }
    } else {
      sendResponse({ status: 'Error', message: 'Element not found' });
    }
  }
  return true; // for async sendResponse
});

function findElement(target) {
  let bestMatch = null;
  let highestScore = -1;

  document.querySelectorAll(target.tag).forEach(el => {
    if (!isElementVisible(el)) return;

    let score = 0;
    // Compare attributes
    for (const key in target.attributes) {
      if (el.getAttribute(key) === target.attributes[key]) {
        score++;
      }
    }
    // Compare text content
    if (target.text && (el.innerText === target.text || el.value === target.text)) {
      score += 2; // Text match is a strong signal
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = el;
    }
  });

  return bestMatch;
}

function highlightElement(el) {
  const originalStyle = el.style.border;
  el.style.border = '3px solid red';
  setTimeout(() => {
    el.style.border = originalStyle;
  }, 2000); // Highlight for 2 seconds
}

function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
}
