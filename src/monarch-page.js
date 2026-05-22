// monarch-page.js — Injected into MAIN world on app.monarch.com
// Monarch uses session cookies + CSRF token for API auth (no longer a localStorage token).
// Running in MAIN world on app.monarch.com lets us use credentials: "include" to send
// those cookies cross-site to api.monarch.com, matching what the Monarch app itself does.

if (!window.__monarchPageRegistered) {
  window.__monarchPageRegistered = true;

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? match[1] : null;
  }

  window.addEventListener("message", async function(event) {
    if (!event.data || event.data._source !== "monarch_pl_sync_monarch_ext") return;

    const { _action, _reqId } = event.data;

    if (_action !== "getAccounts") return;

    try {
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        window.postMessage({
          _source: "monarch_pl_sync_monarch_page", _reqId,
          success: false,
          error: "Could not find CSRF token. Make sure you are logged into Monarch in this tab.",
        }, "*");
        return;
      }

      const res = await fetch("https://api.monarch.com/graphql", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "client-platform": "web",
          "X-Csrftoken": csrfToken,
          "Monarch-Client": "monarch-core-web-app-graphql",
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
