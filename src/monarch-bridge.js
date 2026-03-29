// monarch-bridge.js — Content script (ISOLATED world) for app.monarch.com
// Relays messages between background and monarch-page.js (MAIN world)

if (!window.__monarchBridgeRegistered) {
  window.__monarchBridgeRegistered = true;

  // Relay page postMessage → background
  window.addEventListener("message", (event) => {
    if (event.data?._source === "monarch_pl_sync_monarch_page") {
      chrome.runtime.sendMessage({ type: "MONARCH_BRIDGE_RESPONSE", payload: event.data })
        .catch(() => {});
    }
  });

  // Relay background request → page via postMessage
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "MONARCH_BRIDGE_REQUEST") {
      window.postMessage({ _source: "monarch_pl_sync_monarch_ext", ...message.payload }, "*");
      sendResponse({ received: true });
    }
  });

  console.log("[Monarch-Bridge] Content script registered");
}
