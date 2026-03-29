// pl-bridge.js — Content script (ISOLATED world)
// Relays messages between background and the page-context script (pl-page.js)
// which runs in MAIN world and can access window.projectionlabPluginAPI.

if (!window.__plBridgeRegistered) {
  window.__plBridgeRegistered = true;

  // Relay page postMessage → background
  window.addEventListener("message", (event) => {
    if (event.data?._source === "monarch_pl_sync_page") {
      chrome.runtime.sendMessage({ type: "PL_BRIDGE_RESPONSE", payload: event.data })
        .catch(() => {});
    }
  });

  // Relay background request → page via postMessage
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PL_BRIDGE_REQUEST") {
      window.postMessage({ _source: "monarch_pl_sync_ext", ...message.payload }, "*");
      sendResponse({ received: true });
    }
  });

  console.log("[PL-Bridge] Content script registered");
}
