'use strict';

const API_URL = 'http://localhost:3000/events';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'UX_EVENT') {
    return;
  }

  void postEvent(message.payload)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      console.error('Failed to send UX event:', error);
      sendResponse({ ok: false, error: error.message });
    });

  // Keep the message channel open for async response.
  return true;
});

async function postEvent(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}
