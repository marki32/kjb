// This script is the service worker for the extension.

/**************************************************************************************************
 * IMPORTANT: API KEY CONFIGURATION
 *
 * To use this extension, you need a Gemini API key.
 * 1. Go to Google AI Studio: https://aistudio.google.com/app/apikey
 * 2. Create a new API key.
 * 3. Replace the placeholder 'YOUR_API_KEY_HERE' below with your actual key.
 **************************************************************************************************/
const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processPrompt') {
    const userPrompt = request.prompt;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) {
        sendResponse({ status: 'Error', message: 'No active tab found.' });
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: 'getDOM' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.dom) {
          sendResponse({ status: 'Error', message: 'Could not analyze the page.' });
          return;
        }

        callGeminiApi(userPrompt, response.dom, activeTab.url).then(apiResponse => {
          const actionText = apiResponse.candidates[0].content.parts[0].text;
          const parsedAction = parseAction(actionText);

          if (parsedAction) {
            handleAction(parsedAction, activeTab.id, sendResponse);
          } else {
            sendResponse({ status: 'Error', message: 'Could not understand the next action.' });
          }
        }).catch(error => {
          console.error('API call failed:', error);
          sendResponse({ status: 'Error', message: error.message });
        });
      });
    });

    return true;
  }
});

function handleAction(parsedAction, tabId, sendResponse) {
  const { command, args } = parsedAction;
  switch (command) {
    case 'CLICK':
    case 'TYPE':
      chrome.tabs.sendMessage(tabId, { action: 'executeAction', command, args }, (res) => {
        if (chrome.runtime.lastError) {
          sendResponse({ status: 'Error', message: 'Action failed on page.' });
        } else {
          sendResponse({ status: 'Success', message: `Action ${command} executed.` });
        }
      });
      break;
    case 'ANSWER':
    case 'SUMMARY':
       sendResponse({ status: 'Result', data: args[0] });
       break;
    default:
      sendResponse({ status: 'Error', message: `Unknown command: ${command}` });
  }
}

function parseAction(text) {
    try {
        const match = text.match(/(\w+)\((.*)\)/s); // Use 's' flag for multiline matching
        if (!match) return null;

        const command = match[1].trim();
        let argsString = match[2].trim();

        if (command === 'TYPE') {
            const firstArgEnd = argsString.lastIndexOf('}');
            const targetStr = argsString.substring(0, firstArgEnd + 1);
            const valueStr = argsString.substring(firstArgEnd + 1).trim().slice(1, -1); // remove comma and quotes
            const target = JSON.parse(targetStr);
            return { command, args: [target, valueStr] };
        } else {
            const args = JSON.parse(argsString);
            return { command, args: [args] };
        }
    } catch (e) {
        console.error("Failed to parse action:", text, e);
        return null;
    }
}


async function callGeminiApi(prompt, dom, url) {
  if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('API Key not set. Please update background.js');
  }

  const systemPrompt = `
    You are an agentic browser assistant. Your goal is to help the user accomplish tasks on the current web page.
    The user is on the page: ${url}
    User's prompt: "${prompt}"
    Here is a simplified DOM of the page:
    ${JSON.stringify(dom, null, 2)}
    Based on the prompt and DOM, what is the single next action to take?
    Your response MUST be a single function call from the available functions: CLICK, TYPE, ANSWER, SUMMARY.
  `;

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }),
  });

  if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);
  return response.json();
}
