# UX Tracker MVP Chrome Extension

## Files
- `manifest.json`: Extension manifest (MV3), content script and background worker wiring.
- `content.js`: Captures click events and sends sanitized event payloads.
- `background.js`: Forwards events to `http://localhost:3000/events`.

## Load in Chrome
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` folder.
5. Ensure your local backend is running on `http://localhost:3000`.
6. Open any webpage and click around.
7. Verify ingestion via backend logs or by calling your API endpoints.

## Event payload example
```json
{
  "sessionId": "sess_...",
  "eventType": "click",
  "eventTimestamp": 1710000000000,
  "pageUrl": "https://example.com",
  "metadata": {
    "elementType": "button",
    "elementId": "submit",
    "elementClass": "btn primary",
    "trackingVersion": "1.0"
  }
}
```

## Privacy guardrails
- Clicks on potentially sensitive fields are ignored (`password`, `email`, `tel`, etc.).
- No input values are collected.
- Payload is minimal and extensible for future event types.
