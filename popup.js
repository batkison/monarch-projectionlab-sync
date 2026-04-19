// popup.js

// ─── State ───────────────────────────────────────────────────────────────────
let previewData = [];
let monarchConnected = false;

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showStatus(barId, message, type = "info") {
  const el = $(barId);
  el.className = "status-bar " + type;
  el.textContent = message;
}
function clearStatus(barId) {
  const el = $(barId);
  el.className = "status-bar";
  el.textContent = "";
}
function showCardAlert(id, msg, type) {
  const el = $(id);
  el.className = "settings-card-alert " + type;
  el.textContent = msg;
}
function clearCardAlert(id) {
  const el = $(id);
  el.className = "settings-card-alert";
  el.textContent = "";
}
function setMonarchStatus(connected, label) {
  const el = $("monarch-saved-status");
  el.className = "settings-card-status " + (connected ? "saved" : "unsaved");
  el.textContent = label;
  monarchConnected = connected;
}
function setSavedStatus(id, saved) {
  const el = $(id);
  el.className = "settings-card-status " + (saved ? "saved" : "unsaved");
  el.textContent = saved ? "✓ saved" : "not saved";
}
function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="spinner">⏳</span> ${text}…` : text;
}
function formatBalance(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function escHtml(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function updateLastSyncLabel() {
  chrome.storage.sync.get(["lastSync"], ({ lastSync }) => {
    const el = $("last-sync-label");
    el.textContent = lastSync ? `Last synced: ${new Date(lastSync).toLocaleString()}` : "";
  });
}
function updateMappingSummary() {
  chrome.storage.sync.get(["accountMapping"], ({ accountMapping }) => {
    const el = $("mapping-summary");
    if (!el) return;
    const n = accountMapping?.length ?? 0;
    el.textContent = n > 0 ? `${n} account link${n !== 1 ? "s" : ""} configured` : "No links configured yet.";
  });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    $("tab-" + tab.dataset.tab).classList.add("active");
    if (tab.dataset.tab === "mapping") updateMappingSummary();
  });
});
$("open-settings").addEventListener("click", () => document.querySelector('[data-tab="settings"]').click());
$("go-settings-btn")?.addEventListener("click", () => document.querySelector('[data-tab="settings"]').click());

// ─── Mapping tab — open options page ─────────────────────────────────────────
$("open-mapping-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());

// ─── Settings — load & auto-detect Monarch ──────────────────────────────────
chrome.storage.sync.get(["monarchToken", "plApiKey"], ({ monarchToken, plApiKey }) => {
  if (monarchToken) { $("monarch-token").value = monarchToken; }
  if (plApiKey)     { $("pl-api-key").value = plApiKey; setSavedStatus("pl-saved-status", true); }

  testMonarchConnection(monarchToken);

  checkSetupComplete();
  updateLastSyncLabel();
  updateMappingSummary();
});
$("pl-api-key").addEventListener("input", () => setSavedStatus("pl-saved-status", false));

// ─── Monarch connection test ────────────────────────────────────────────────
async function testMonarchConnection(token) {
  setMonarchStatus(false, "checking…");
  let result = await chrome.runtime.sendMessage({ type: "VALIDATE_MONARCH_TOKEN" });
  if (!result.success && token) {
    result = await chrome.runtime.sendMessage({ type: "VALIDATE_MONARCH_TOKEN", token });
  }
  if (result.success) {
    setMonarchStatus(true, "✓ connected");
    showCardAlert("monarch-alert", `✓ Connected to Monarch (${result.accounts.length} accounts found)`, "success");
  } else {
    setMonarchStatus(false, "not connected");
    showCardAlert("monarch-alert", "Open app.monarch.com in a tab and log in, then try again. Or provide a session token below.", "error");
  }
  checkSetupComplete();
}

// ─── Settings — Monarch ───────────────────────────────────────────────────────
$("save-monarch-btn").addEventListener("click", () => {
  const token = $("monarch-token").value.trim();
  if (!token) { showCardAlert("monarch-alert", "Please enter a token.", "error"); return; }
  clearCardAlert("monarch-alert");
  chrome.storage.sync.set({ monarchToken: token }, () => {
    showCardAlert("monarch-alert", "✓ Token saved.", "success");
    testMonarchConnection(token);
    setTimeout(() => clearCardAlert("monarch-alert"), 3000);
  });
});
$("test-monarch-btn").addEventListener("click", async () => {
  const btn = $("test-monarch-btn");
  const token = $("monarch-token").value.trim();
  setLoading(btn, true, "Testing");
  clearCardAlert("monarch-alert");
  await testMonarchConnection(token || undefined);
  setLoading(btn, false, "🔌 Test Connection");
});

// ─── Settings — ProjectionLab ────────────────────────────────────────────────
$("save-pl-btn").addEventListener("click", () => {
  const key = $("pl-api-key").value.trim();
  if (!key) { showCardAlert("pl-alert", "Please enter your ProjectionLab API key first.", "error"); return; }
  clearCardAlert("pl-alert");
  chrome.storage.sync.set({ plApiKey: key }, () => {
    setSavedStatus("pl-saved-status", true);
    showCardAlert("pl-alert", "✓ ProjectionLab key saved.", "success");
    checkSetupComplete();
    setTimeout(() => clearCardAlert("pl-alert"), 3000);
  });
});
$("test-pl-btn").addEventListener("click", async () => {
  const btn = $("test-pl-btn");
  const key = $("pl-api-key").value.trim();
  if (!key) { showCardAlert("pl-alert", "Enter your ProjectionLab API key first.", "error"); return; }
  setLoading(btn, true, "Testing");
  clearCardAlert("pl-alert");
  const result = await callProjectionLab("exportData", { key });
  setLoading(btn, false, "🔌 Test");
  if (result.success) showCardAlert("pl-alert", "✓ Connected to ProjectionLab!", "success");
  else if (result.error?.includes("No ProjectionLab")) showCardAlert("pl-alert", "Open app.projectionlab.com or ea.projectionlab.com in a tab first.", "error");
  else showCardAlert("pl-alert", result.error || "Connection failed.", "error");
});

// ─── Sync tab ─────────────────────────────────────────────────────────────────
function checkSetupComplete() {
  chrome.storage.sync.get(["plApiKey", "accountMapping"], (data) => {
    const ready = monarchConnected && data.plApiKey && data.accountMapping?.length > 0;
    $("setup-required").style.display = ready ? "none" : "block";
    $("sync-ready").style.display     = ready ? "block" : "none";
  });
}

// ─── Preview with checkboxes ─────────────────────────────────────────────────
$("preview-btn").addEventListener("click", async () => {
  const btn = $("preview-btn");
  clearStatus("status-bar");
  setLoading(btn, true, "👁 Loading");

  const { monarchToken, plApiKey, accountMapping } = await getStoredCredentials();
  if (!plApiKey || !accountMapping?.length) {
    showStatus("status-bar", "Complete Settings and Account Mapping first.", "error");
    setLoading(btn, false, "👁 Load Preview");
    return;
  }

  let mResult = await chrome.runtime.sendMessage({ type: "FETCH_MONARCH_ACCOUNTS" });
  if (!mResult.success && monarchToken) {
    mResult = await chrome.runtime.sendMessage({ type: "FETCH_MONARCH_ACCOUNTS", token: monarchToken });
  }
  if (!mResult.success) {
    showStatus("status-bar", `Monarch: ${mResult.error}`, "error");
    setLoading(btn, false, "👁 Load Preview");
    return;
  }

  const plResult = await callProjectionLab("exportData", { key: plApiKey });
  if (!plResult.success) {
    showStatus("status-bar", `ProjectionLab: ${plResult.error || "Open app.projectionlab.com or ea.projectionlab.com in a tab."}`, "error");
    setLoading(btn, false, "👁 Load Preview");
    return;
  }

  const today = plResult.result?.today || {};
  const allPl = [
    ...(today.savingsAccounts    || []),
    ...(today.investmentAccounts || []),
    ...(today.assets             || []),
    ...(today.debts              || []),
  ];

  previewData = [];
  for (const m of accountMapping) {
    const mAcc = mResult.accounts.find(a => a.id === m.monarchId);
    const pAcc = allPl.find(a => a.id === m.plId);
    if (!mAcc || !pAcc) continue;
    const plField = m.plField ?? "balance";
    const pAccBalance = pAcc[plField] ?? 0;
    const hasChanged = Math.abs(mAcc.balance - pAccBalance) >= 0.01;
    previewData.push({
      monarchId: mAcc.id,
      plId: pAcc.id,
      plField,
      name: mAcc.name,
      plName: pAcc.name,
      oldBalance: pAccBalance,
      newBalance: mAcc.balance,
      hasChanged,
      selected: hasChanged,
    });
  }

  renderPreview();
  setLoading(btn, false, "👁 Load Preview");
  updateSyncButtonState();
  if (previewData.length === 0) showStatus("status-bar", "No matching accounts found. Check your mapping.", "warning");
});

$("hide-unchanged")?.addEventListener("change", () => renderPreview());

function renderPreview() {
  const area = $("preview-area");
  const hideUnchanged = $("hide-unchanged")?.checked ?? false;

  let visible = previewData;
  if (hideUnchanged) {
    visible = previewData.filter(row => row.hasChanged);
  }

  if (previewData.length === 0) {
    area.innerHTML = `<p class="empty-state">No mapped accounts found.</p>`;
    return;
  }
  if (visible.length === 0) {
    const unchangedCount = previewData.filter(r => !r.hasChanged).length;
    area.innerHTML = `<p class="empty-state">All ${unchangedCount} account(s) are up to date — nothing to sync! ✓</p>`;
    updateSyncButtonState();
    return;
  }

  const rows = visible.map((row) => {
    const realIdx = previewData.indexOf(row);
    const diff = row.newBalance - row.oldBalance;
    const diffStr = diff === 0 ? "" : ` <span style="color:${diff > 0 ? "#4ade80" : "#f87171"}">${diff > 0 ? "+" : ""}${formatBalance(diff)}</span>`;
    const checked = row.selected ? "checked" : "";
    const rowCls = !row.selected ? "row-disabled" : "";
    return `<tr class="${rowCls}">
      <td class="cb-cell"><input type="checkbox" class="sync-cb" data-idx="${realIdx}" ${checked} /></td>
      <td>${escHtml(row.name)}</td>
      <td class="balance-old">${formatBalance(row.oldBalance)}</td>
      <td class="${diff === 0 ? "balance-same" : "balance-new"}">${formatBalance(row.newBalance)}${diffStr}</td>
    </tr>`;
  }).join("");

  const allChecked = visible.every(r => r.selected);

  area.innerHTML = `
    <table class="preview-table">
      <thead><tr>
        <th class="cb-cell"><input type="checkbox" class="sync-cb" id="select-all-cb" ${allChecked ? "checked" : ""} /></th>
        <th>Account</th>
        <th>Current (PL)</th>
        <th>New (Monarch)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  // Wire up individual checkboxes
  area.querySelectorAll(".sync-cb[data-idx]").forEach(cb => {
    cb.addEventListener("change", () => {
      const idx = parseInt(cb.dataset.idx);
      previewData[idx].selected = cb.checked;
      updateSyncButtonState();
      const tr = cb.closest("tr");
      tr.classList.toggle("row-disabled", !cb.checked);
      // Update select-all state
      const allCb = $("select-all-cb");
      const hideUnchanged = $("hide-unchanged")?.checked ?? false;
      const vis = hideUnchanged ? previewData.filter(r => r.hasChanged) : previewData;
      allCb.checked = vis.every(r => r.selected);
    });
  });

  // Select-all checkbox
  $("select-all-cb")?.addEventListener("change", (e) => {
    const hideUnchanged = $("hide-unchanged")?.checked ?? false;
    const vis = hideUnchanged ? previewData.filter(r => r.hasChanged) : previewData;
    for (const row of vis) row.selected = e.target.checked;
    renderPreview();
    updateSyncButtonState();
  });
}

function updateSyncButtonState() {
  const selectedCount = previewData.filter(r => r.selected).length;
  $("sync-btn").disabled = selectedCount === 0;
  $("sync-btn").textContent = selectedCount > 0
    ? `⚡ Sync Selected (${selectedCount})`
    : "⚡ Sync Selected";
}

// ─── Sync ────────────────────────────────────────────────────────────────────
$("sync-btn").addEventListener("click", async () => {
  const btn = $("sync-btn");
  const { plApiKey } = await getStoredCredentials();
  const toSync = previewData.filter(r => r.selected && r.hasChanged);

  if (!toSync.length) {
    showStatus("status-bar", "No accounts selected with changes to sync.", "warning");
    return;
  }

  setLoading(btn, true, "⚡ Syncing");
  clearStatus("status-bar");

  let successCount = 0;
  const errors = [];
  for (const row of toSync) {
    const result = await callProjectionLab("updateAccount", { key: plApiKey, accountId: row.plId, balance: row.newBalance, field: row.plField ?? "balance" });
    if (result.success) successCount++;
    else errors.push(`${row.name}: ${result.error}`);
  }

  setLoading(btn, false, "⚡ Sync Selected");
  if (errors.length === 0) {
    showStatus("status-bar", `✓ Synced ${successCount} account(s) successfully!`, "success");
    chrome.storage.sync.set({ lastSync: new Date().toISOString() }, updateLastSyncLabel);
    for (const row of toSync) {
      row.oldBalance = row.newBalance;
      row.hasChanged = false;
      row.selected = false;
    }
    renderPreview();
    updateSyncButtonState();
  } else {
    showStatus("status-bar", errors.length < toSync.length
      ? `⚠️ ${successCount} synced, ${errors.length} failed: ${errors[0]}`
      : `✗ All updates failed: ${errors[0]}`, "error");
  }
});

// ─── ProjectionLab ────────────────────────────────────────────────────────────
function callProjectionLab(action, payload) {
  return chrome.runtime.sendMessage({ type: "CALL_PL", action, payload });
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function getStoredCredentials() {
  return new Promise(resolve => chrome.storage.sync.get(["monarchToken", "plApiKey", "accountMapping"], resolve));
}
