// pl-page.js — Injected into MAIN world via chrome.scripting.executeScript
// Has direct access to window.projectionlabPluginAPI.
//
// Supports both Plugin API contracts. The contract is detected on every call (never cached),
// per ProjectionLab's migration guide: V5 exposes api.version === 2, V4 has no version property.
//
// Message tags are versioned ("_v2") so a stale listener left in an already-open tab by an
// older extension version never answers requests meant for this one.

if (!window.__plPageRegisteredV2) {
  window.__plPageRegisteredV2 = true;

  const SUPPORTED = [1, 2];
  const reply = (_reqId, body) =>
    window.postMessage({ _source: "monarch_pl_sync_page_v2", _reqId, ...body }, "*");

  window.addEventListener("message", async function(event) {
    if (event.source !== window || event.data?._source !== "monarch_pl_sync_ext_v2") return;

    const { _action, _reqId, payload } = event.data;
    const api = window.projectionlabPluginAPI;

    if (!api) {
      reply(_reqId, {
        success: false,
        error: "PL_API_NOT_FOUND: Plugins not enabled or API key wrong. Go to ProjectionLab → Account Settings → Plugins → enable Plugins and copy your API key.",
      });
      return;
    }

    const apiVersion = api.version ?? 1;
    if (!SUPPORTED.includes(apiVersion)) {
      reply(_reqId, {
        success: false,
        error: `This ProjectionLab release uses Plugin API version ${apiVersion}, which this extension doesn't support yet. Check for an extension update.`,
      });
      return;
    }

    try {
      const key = payload?.key;
      let result = null;

      if (_action === "getAccounts") {
        if (apiVersion === 2) {
          result = { apiVersion, accounts: await api.getAccounts({ key }) };
        } else {
          const data = await api.exportData({ key });
          result = { apiVersion, today: data?.today ?? {} };
        }

      } else if (_action === "updateValue") {
        const { accountId, field, value, expectVersion } = payload;
        if (expectVersion != null && expectVersion !== apiVersion) {
          throw new Error("ProjectionLab was updated since the preview loaded. Refresh the preview and try again.");
        }
        if (!Number.isFinite(value)) throw new Error(`Invalid amount: ${value}`);
        if (apiVersion === 2) {
          // Never fall back to the V4 path on a V5 failure.
          await api.updateAccountValues({ accountId, values: { [field]: value }, key });
        } else {
          await Promise.resolve(api.updateAccount(accountId, { [field]: value }, { key }));
        }
        result = { apiVersion };

      } else {
        throw new Error(`Unknown action: ${_action}`);
      }

      reply(_reqId, { success: true, result });
    } catch (err) {
      reply(_reqId, { success: false, error: err?.message ?? String(err) });
    }
  });

  console.log("[PL-Page] Registered, Plugin API version:",
    window.projectionlabPluginAPI ? (window.projectionlabPluginAPI.version ?? 1) : "not found");
}
