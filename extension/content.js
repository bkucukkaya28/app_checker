'use strict';

const TRACKING_CONFIG = {
  enabledEventTypes: {
    click: true,
    // Future extension points:
    // scroll: false,
    // input: false,
  },
};

const sessionId = getOrCreateSessionId();

if (TRACKING_CONFIG.enabledEventTypes.click) {
  document.addEventListener('click', handleClickEvent, { capture: true, passive: true });
}

function handleClickEvent(event) {
  const element = event.target;
  if (!(element instanceof Element)) {
    return;
  }

  if (isSensitiveElement(element)) {
    return;
  }

  const payload = buildClickPayload(element);
  chrome.runtime.sendMessage({
    type: 'UX_EVENT',
    payload,
  });
}

function buildClickPayload(element) {
  return {
    sessionId,
    eventType: 'click',
    eventTimestamp: Date.now(),
    pageUrl: window.location.href,
    metadata: {
      elementType: getElementType(element),
      elementId: element.id || null,
      elementClass: sanitizeClassName(element.className),
      // Extensible metadata placeholder for future tracking dimensions.
      trackingVersion: '1.0',
    },
  };
}

function getElementType(element) {
  return (element.tagName || 'unknown').toLowerCase();
}

function sanitizeClassName(className) {
  if (!className) return null;
  if (typeof className !== 'string') return null;

  // Keep payload lightweight by limiting class payload length.
  const trimmed = className.trim().replace(/\s+/g, ' ');
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}

function isSensitiveElement(element) {
  const tag = (element.tagName || '').toLowerCase();
  if (tag !== 'input' && tag !== 'textarea') {
    return false;
  }

  const type = (element.getAttribute('type') || '').toLowerCase();
  const name = (element.getAttribute('name') || '').toLowerCase();
  const id = (element.getAttribute('id') || '').toLowerCase();
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();

  const blockedTypes = new Set(['password', 'email', 'tel', 'number']);
  if (blockedTypes.has(type)) return true;

  const sensitiveKeywords = ['password', 'pass', 'pwd', 'token', 'secret', 'credit', 'card', 'iban', 'ssn'];
  const combined = `${name} ${id} ${autocomplete}`;
  return sensitiveKeywords.some((keyword) => combined.includes(keyword));
}

function getOrCreateSessionId() {
  const key = 'ux_tracker_session_id';
  const storage = window.sessionStorage;
  const existing = storage.getItem(key);

  if (existing) {
    return existing;
  }

  const created = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  storage.setItem(key, created);
  return created;
}
