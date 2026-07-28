// Test stub for chrome.* APIs — configured via ?state= query param
const params = new URLSearchParams(location.search || location.hash.slice(1));
const state = window.__STATE__ || params.get("state") || "ready"; // ready | fresh | partial

const mockStorage = {
  ready: {
    plApiKey: "pl_test_key_123",
    accountMapping: [
      { monarchId: "m1", plId: "p1" },
      { monarchId: "m2", plId: "p2" },
      { monarchId: "m3", plId: "p3" },
      { monarchId: "m4", plId: "p4" },
      { monarchId: "m5", plId: "p5" },
    ],
    lastSync: "2026-07-20T15:42:15.000Z",
    syncCount: 0,
    rateDismissed: false,
  },
  fresh: {},
  partial: { plApiKey: "pl_test_key_123" },
};

const monarchAccounts = [
  { id: "m1", name: "Primary Checking",   balance: 13892 },
  { id: "m2", name: "High Yield Savings", balance: 46100 },
  { id: "m3", name: "Roth IRA",           balance: 81205 },
  { id: "m4", name: "Brokerage Account",  balance: 122890 },
  { id: "m5", name: "Credit Card",        balance: -2340 },
];
const plToday = {
  savingsAccounts:    [ { id: "p1", name: "Checking", balance: 12450 }, { id: "p2", name: "Savings", balance: 45200 } ],
  investmentAccounts: [ { id: "p3", name: "Roth IRA", balance: 78340 }, { id: "p4", name: "Brokerage", balance: 125600 } ],
  assets: [],
  debts: [ { id: "p5", name: "Credit Card", balance: -2340 } ],
};

const store = { ...mockStorage[state] };
window.chrome = {
  storage: {
    sync: {
      get: (keys, cb) => setTimeout(() => {
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => { if (k in store) out[k] = store[k]; });
        cb(out);
      }, 30),
      set: (obj, cb) => { Object.assign(store, obj); cb && setTimeout(cb, 10); },
    },
  },
  runtime: {
    sendMessage: async (msg) => {
      await new Promise(r => setTimeout(r, 300));
      if (state === "fresh" || state === "partial") {
        if (msg.type === "VALIDATE_MONARCH_TOKEN") return state === "partial" ? { success: true, accounts: monarchAccounts } : { success: false, error: "no tab" };
      }
      if (msg.type === "VALIDATE_MONARCH_TOKEN" || msg.type === "FETCH_MONARCH_ACCOUNTS")
        return { success: true, accounts: monarchAccounts };
      if (msg.type === "CALL_PL") {
        if ((window.__NOPL__ || params.get("nopl") === "1")) return { success: false, error: "No ProjectionLab tab found. Open app.projectionlab.com or ea.projectionlab.com first." };
        if (msg.action === "exportData") return { success: true, result: { today: plToday } };
        if (msg.action === "updateAccount") { await new Promise(r => setTimeout(r, 600)); return { success: true }; }
      }
      return { success: false, error: "unknown" };
    },
    openOptionsPage: () => console.log("[stub] openOptionsPage"),
  },
  tabs: { create: (o) => console.log("[stub] tabs.create", o.url) },
};
