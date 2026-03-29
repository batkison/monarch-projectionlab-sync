// background.js

const MONARCH_API = "https://api.monarch.com/graphql";

const GET_ACCOUNTS_BODY = JSON.stringify({
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
});

const _monarchPending = {};
const _plPending = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_MONARCH_ACCOUNTS" || message.type === "VALIDATE_MONARCH_TOKEN") {
    fetchMonarchAccounts(message.token)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Monarch bridge responses (from monarch-bridge.js content script)
  if (message.type === "MONARCH_BRIDGE_RESPONSE") {
    const reqId = message.payload?._reqId;
    const pending = _monarchPending[reqId];
    if (pending) { delete _monarchPending[reqId]; pending(message.payload); }
    return false;
  }

  if (message.type === "PL_BRIDGE_RESPONSE") {
    const reqId = message.payload?._reqId;
    const pending = _plPending[reqId];
    if (pending) { delete _plPending[reqId]; pending(message.payload); }
    return false;
  }

  if (message.type === "CALL_PL") {
    callProjectionLabTab(message.action, message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ─── Monarch ──────────────────────────────────────────────────────────────────

async function fetchMonarchAccountsViaBridge() {
  // Find an open Monarch tab
  const tabs = await chrome.tabs.query({ url: "https://app.monarch.com/*" });
  if (!tabs.length) {
    return { success: false, error: "NO_MONARCH_TAB" };
  }
  const tab = tabs[0];

  // Inject the bridge content script (ISOLATED world)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/monarch-bridge.js"],
      world: "ISOLATED",
    });
  } catch (_) {}

  // Inject the MAIN world script (has access to page cookies for fetch)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/monarch-page.js"],
      world: "MAIN",
    });
  } catch (err) {
    console.warn("[BG] monarch-page.js injection error:", err.message);
  }

  await new Promise(r => setTimeout(r, 200));

  const reqId = Math.random().toString(36).slice(2);

  return new Promise((resolve) => {
    _monarchPending[reqId] = (p) => {
      if (p.success) {
        resolve({ success: true, accounts: p.result });
      } else {
        resolve({ success: false, error: p.error });
      }
    };

    chrome.tabs.sendMessage(tab.id, {
      type: "MONARCH_BRIDGE_REQUEST",
      payload: { _action: "getAccounts", _reqId: reqId },
    }, (ack) => {
      if (chrome.runtime.lastError) {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            type: "MONARCH_BRIDGE_REQUEST",
            payload: { _action: "getAccounts", _reqId: reqId },
          }, (retryAck) => {
            if (chrome.runtime.lastError) {
              delete _monarchPending[reqId];
              resolve({ success: false, error: "Could not reach Monarch tab. Try refreshing app.monarch.com." });
            }
          });
        }, 800);
      }
    });

    setTimeout(() => {
      if (_monarchPending[reqId]) {
        delete _monarchPending[reqId];
        resolve({ success: false, error: "Monarch tab did not respond. Try refreshing app.monarch.com." });
      }
    }, 15000);
  });
}

async function fetchMonarchAccountsWithToken(token) {
  const headers = {
    "Content-Type": "application/json",
    "client-platform": "web",
  };
  headers["Authorization"] = `Token ${token}`;

  let res;
  try {
    res = await fetch(MONARCH_API, {
      method: "POST",
      headers,
      body: GET_ACCOUNTS_BODY,
    });
  } catch (err) {
    return { success: false, error: "Network error reaching Monarch API." };
  }

  const text = await res.text();
  if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };

  let data;
  try { data = JSON.parse(text); } catch { return { success: false, error: "Invalid response from Monarch API." }; }
  if (data.errors) return { success: false, error: data.errors.map(e => e.message).join("; ") };

  const raw = data?.data?.accounts;
  if (!Array.isArray(raw)) return { success: false, error: "Unexpected response: " + JSON.stringify(data).slice(0, 200) };

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

  return { success: true, accounts };
}

async function fetchMonarchAccounts(token) {
  // If a manual token is provided, use it directly (no tab needed)
  if (token) {
    return fetchMonarchAccountsWithToken(token);
  }

  // Otherwise, try the bridge approach (uses logged-in session via the Monarch tab)
  const result = await fetchMonarchAccountsViaBridge();

  if (!result.success && result.error === "NO_MONARCH_TAB") {
    return {
      success: false,
      error: "No Monarch tab found. Please open app.monarch.com and log in, or provide a session token in Settings.",
    };
  }

  return result;
}

// ─── ProjectionLab ────────────────────────────────────────────────────────────

async function callProjectionLabTab(action, payload) {
  const tabs = await chrome.tabs.query({ url: "https://app.projectionlab.com/*" });
  if (!tabs.length) {
    return { success: false, error: "No ProjectionLab tab found. Open app.projectionlab.com first." };
  }
  const tab = tabs[0];

  // 1. Inject isolated-world content script (handles postMessage relay)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/pl-bridge.js"],
      world: "ISOLATED",
    });
  } catch (_) {}

  // 2. Inject MAIN world script (accesses window.projectionlabPluginAPI — no CSP issues)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/pl-page.js"],
      world: "MAIN",
    });
  } catch (err) {
    console.warn("[BG] pl-page.js injection error:", err.message);
  }

  await new Promise(r => setTimeout(r, 200));

  const reqId = Math.random().toString(36).slice(2);

  return new Promise((resolve) => {
    _plPending[reqId] = (p) => resolve({ success: p.success, result: p.result, error: p.error });

    chrome.tabs.sendMessage(tab.id, {
      type: "PL_BRIDGE_REQUEST",
      payload: { _action: action, _reqId: reqId, payload },
    }, (ack) => {
      if (chrome.runtime.lastError) {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            type: "PL_BRIDGE_REQUEST",
            payload: { _action: action, _reqId: reqId, payload },
          }, (retryAck) => {
            if (chrome.runtime.lastError) {
              delete _plPending[reqId];
              resolve({ success: false, error: "Could not reach ProjectionLab tab. Try refreshing app.projectionlab.com." });
            }
          });
        }, 800);
      }
    });

    setTimeout(() => {
      if (_plPending[reqId]) {
        delete _plPending[reqId];
        resolve({ success: false, error: "ProjectionLab did not respond. Make sure Plugins are enabled in PL Account Settings." });
      }
    }, 15000);
  });
}
