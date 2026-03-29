// pl-page.js — Injected into MAIN world via chrome.scripting.executeScript
// Has direct access to window.projectionlabPluginAPI

if (!window.__plPageRegistered) {
  window.__plPageRegistered = true;

  window.addEventListener("message", async function(event) {
    if (!event.data || event.data._source !== "monarch_pl_sync_ext") return;

    const { _action, _reqId, payload } = event.data;
    const api = window.projectionlabPluginAPI;

    if (!api) {
      window.postMessage({
        _source: "monarch_pl_sync_page", _reqId,
        success: false,
        error: "PL_API_NOT_FOUND: Plugins not enabled or API key wrong. Go to ProjectionLab → Account Settings → Plugins → enable Plugins and copy your API key.",
      }, "*");
      return;
    }

    try {
      let result = null;
      if (_action === "exportData") {
        result = await api.exportData({ key: payload.key });
      } else if (_action === "updateAccount") {
        result = await Promise.resolve(api.updateAccount(payload.accountId, { balance: payload.balance }, { key: payload.key }));
      }
      window.postMessage({ _source: "monarch_pl_sync_page", _reqId, success: true, result }, "*");
    } catch(err) {
      window.postMessage({ _source: "monarch_pl_sync_page", _reqId, success: false, error: err.message }, "*");
    }
  });

  console.log("[PL-Page] Main world script registered, projectionlabPluginAPI:", typeof window.projectionlabPluginAPI);
}
