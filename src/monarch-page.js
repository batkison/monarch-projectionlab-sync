// monarch-page.js — Injected into MAIN world on app.monarch.com
// Reads the auth token from localStorage and makes authenticated GraphQL calls.
// Monarch uses "Authorization: Token xxx" (not cookies) for API auth.

if (!window.__monarchPageRegistered) {
  window.__monarchPageRegistered = true;

  // Extract the Monarch auth token from localStorage.
  // Monarch stores it at: persist:root -> user (JSON string) -> token
  function getMonarchToken() {
    try {
      const root = localStorage.getItem("persist:root");
      if (root) {
        const parsed = JSON.parse(root);
        if (parsed.user) {
          const user = JSON.parse(parsed.user);
          if (user.token) return user.token;
        }
      }
    } catch (_) {}

    // Fallback: scan all localStorage keys for anything that looks like a token
    for (const key of Object.keys(localStorage)) {
      const val = localStorage.getItem(key);
      if (!val || val.length < 20) continue;
      // Try to parse JSON values that might contain a token
      if (val.startsWith("{")) {
        try {
          const parsed = JSON.parse(val);
          if (parsed.token && typeof parsed.token === "string" && parsed.token.length > 20) return parsed.token;
          // Check nested: parsed might have a stringified sub-object with a token
          for (const v of Object.values(parsed)) {
            if (typeof v === "string" && v.startsWith("{")) {
              try {
                const inner = JSON.parse(v);
                if (inner.token && typeof inner.token === "string" && inner.token.length > 20) return inner.token;
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }
    return null;
  }

  window.addEventListener("message", async function(event) {
    if (!event.data || event.data._source !== "monarch_pl_sync_monarch_ext") return;

    const { _action, _reqId } = event.data;

    if (_action !== "getAccounts") return;

    try {
      const token = getMonarchToken();
      if (!token) {
        // Log all localStorage keys to help debug
        console.log("[Monarch-Page] localStorage keys:", Object.keys(localStorage));
        window.postMessage({
          _source: "monarch_pl_sync_monarch_page", _reqId,
          success: false,
          error: "Could not find Monarch auth token in localStorage. Make sure you are logged into Monarch in this tab.",
        }, "*");
        return;
      }

      console.log("[Monarch-Page] Found auth token, making API call...");

      const res = await fetch("https://api.monarch.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": "Token " + token,
          "client-platform": "web",
        },
        body: JSON.stringify({
          operationName: "GetAccounts",
          query: `
            query GetAccounts {
              accounts {
                id
                displayName
                currentBalance
                displayBalance
                signedBalance
                isHidden
                hideFromList
                deactivatedAt
                deletedAt
                includeInNetWorth
                institution { name }
                subtype { name display }
                type { name display }
              }
            }
          `,
          variables: {},
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        window.postMessage({
          _source: "monarch_pl_sync_monarch_page", _reqId,
          success: false,
          error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
        }, "*");
        return;
      }

      const data = await res.json();

      if (data.errors) {
        window.postMessage({
          _source: "monarch_pl_sync_monarch_page", _reqId,
          success: false,
          error: data.errors.map(e => e.message).join("; "),
        }, "*");
        return;
      }

      const raw = data?.data?.accounts;
      if (!Array.isArray(raw)) {
        window.postMessage({
          _source: "monarch_pl_sync_monarch_page", _reqId,
          success: false,
          error: "Unexpected response format from Monarch API.",
        }, "*");
        return;
      }

      const accounts = raw
        .filter(a => !a.isHidden && !a.hideFromList && !a.deactivatedAt && !a.deletedAt)
        .map(a => ({
          id: a.id,
          name: a.displayName,
          balance: a.displayBalance ?? a.currentBalance ?? a.signedBalance ?? 0,
          type: a.type?.display ?? a.type?.name ?? "",
          subtype: a.subtype?.display ?? a.subtype?.name ?? "",
          institution: a.institution?.name ?? "",
          includeInNetWorth: a.includeInNetWorth ?? true,
        }));

      window.postMessage({
        _source: "monarch_pl_sync_monarch_page", _reqId,
        success: true,
        result: accounts,
      }, "*");

    } catch (err) {
      window.postMessage({
        _source: "monarch_pl_sync_monarch_page", _reqId,
        success: false,
        error: err.message,
      }, "*");
    }
  });

  console.log("[Monarch-Page] Main world script registered");
}
