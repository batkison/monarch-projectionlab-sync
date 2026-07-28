// Rich chrome.* stub for store screenshots
const MOCK_STORE = {
  plApiKey: "pl_test_key_123",
  accountMapping: [
    { monarchId: "m1", plId: "p1", plField: "balance" },
    { monarchId: "m2", plId: "p2", plField: "balance" },
    { monarchId: "m3", plId: "p3", plField: "balance" },
    { monarchId: "m8", plId: "p8", plField: "balance" },
    { monarchId: "m7", plId: "p6", plField: "balance" },
  ],
  assetHasLoan: {},
  lastSync: "2026-07-20T15:42:15.000Z",
  syncCount: 0,
};
const MOCK_MONARCH = [
  { id: "m1", name: "Ally Checking",      balance: 13892,   type: "depository", subtype: "checking",   institution: "Ally" },
  { id: "m2", name: "Emergency Fund",     balance: 46100,   type: "depository", subtype: "savings",    institution: "Ally" },
  { id: "m3", name: "Roth IRA",           balance: 81205,   type: "investment", subtype: "ira",        institution: "Fidelity" },
  { id: "m4", name: "Brokerage",          balance: 122890,  type: "investment", subtype: "brokerage",  institution: "Vanguard" },
  { id: "m8", name: "401(k)",             balance: 156780,  type: "investment", subtype: "401k",       institution: "Fidelity" },
  { id: "m5", name: "Chase Sapphire",     balance: -2340,   type: "credit",     subtype: "credit card", institution: "Chase" },
  { id: "m6", name: "Home (Zillow)",      balance: 485000,  type: "property",   subtype: "real estate" },
  { id: "m7", name: "Mortgage",           balance: -312450, type: "loan",       subtype: "mortgage" },
  { id: "m9", name: "Subaru Outback",     balance: 18500,   type: "property",   subtype: "vehicle" },
];
const MOCK_PL_TODAY = {
  savingsAccounts:    [ { id: "p1", name: "Checking", balance: 12450 }, { id: "p2", name: "Emergency Fund", balance: 45200 } ],
  investmentAccounts: [ { id: "p3", name: "Roth IRA", balance: 78340 }, { id: "p4", name: "Brokerage", balance: 125600 }, { id: "p8", name: "401(k)", balance: 152300 } ],
  assets: [ { id: "p6", name: "House", amount: 470000, balance: -315000 }, { id: "p9", name: "Car", amount: 19000 } ],
  debts: [ { id: "p5", name: "Credit Card", balance: -2340 } ],
};
window.chrome = {
  storage: {
    sync: {
      get: (keys, cb) => setTimeout(() => {
        const out = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => { if (k in MOCK_STORE) out[k] = MOCK_STORE[k]; });
        cb(out);
      }, 20),
      set: (obj, cb) => { Object.assign(MOCK_STORE, obj); cb && setTimeout(cb, 10); },
    },
  },
  runtime: {
    sendMessage: async (msg) => {
      await new Promise(r => setTimeout(r, 250));
      if (msg.type === "VALIDATE_MONARCH_TOKEN" || msg.type === "FETCH_MONARCH_ACCOUNTS")
        return { success: true, accounts: MOCK_MONARCH };
      if (msg.type === "CALL_PL") {
        if (msg.action === "exportData") return { success: true, result: { today: MOCK_PL_TODAY } };
        if (msg.action === "updateAccount") { await new Promise(r => setTimeout(r, 500)); return { success: true }; }
      }
      return { success: false, error: "unknown" };
    },
    openOptionsPage: () => {},
  },
  tabs: { create: () => {} },
};
