// popup.js

const STORE_REVIEW_URL = "https://chromewebstore.google.com/detail/mbmlgebglmgfiifpjmemfhhmpgamfcba/reviews";
const RATE_PROMPT_MIN_SYNCS = 3;

// ─── State ───────────────────────────────────────────────────────────────────
let previewData = [];
let monarchConnected = false;
let autoPreviewDone = false;
let syncInProgress = false;

// ─── Icons ───────────────────────────────────────────────────────────────────
const svg = (paths) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  eye:     svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
  zap:     svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  test:    svg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
  save:    svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
  check:   svg('<polyline points="20 6 9 17 4 12"/>'),
  x:       svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  spinner: `<svg class="icon icon-spin" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>`,
};

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function setBtn(btn, icon, label) {
  btn.innerHTML = `${ICONS[icon] ?? ""}<span>${label}</span>`;
}
function setLoading(btn, loading, label) {
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${ICONS.spinner}<span>${label}…</span>`;
  } else {
    btn.disabled = false;
    if (btn.dataset.orig) { btn.innerHTML = btn.dataset.orig; delete btn.dataset.orig; }
  }
}

function showStatus(barId, message, type = "info", action = null) {
  const el = $(barId);
  el.className = "status-bar " + type;
  el.textContent = "";
  const msg = document.createElement("span");
  msg.className = "status-msg";
  msg.textContent = message;
  el.appendChild(msg);
  if (action) {
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost btn-sm";
    btn.textContent = action.label;
    btn.addEventListener("click", action.onClick);
    el.appendChild(btn);
  }
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
function formatBalance(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function escHtml(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function pluralAccounts(n) {
  return `${n} account${n === 1 ? "" : "s"}`;
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

// ─── Default button contents ─────────────────────────────────────────────────
setBtn($("preview-btn"), "eye", "Refresh Preview");
setBtn($("sync-btn"), "zap", "Sync Selected");
setBtn($("test-monarch-btn"), "test", "Test Connection");
setBtn($("test-pl-btn"), "test", "Test");
setBtn($("save-pl-btn"), "save", "Save");

// ─── Tabs (keyboard-accessible) ──────────────────────────────────────────────
const tabButtons = [...document.querySelectorAll(".tab")];
function selectTab(name) {
  tabButtons.forEach(t => {
    const active = t.dataset.tab === name;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  $("tab-" + name).classList.add("active");
  if (name === "mapping") updateMappingSummary();
}
tabButtons.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  tab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = tabButtons[(i + (e.key === "ArrowRight" ? 1 : tabButtons.length - 1)) % tabButtons.length];
    next.focus();
    selectTab(next.dataset.tab);
  });
});
$("open-settings").addEventListener("click", () => selectTab("settings"));

// ─── Mapping tab — open options page ─────────────────────────────────────────
$("open-mapping-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());

// ─── Setup checklist ─────────────────────────────────────────────────────────
function setStepDone(stepId, done) {
  const step = $(stepId);
  step.classList.toggle("done", done);
  const status = step.querySelector(".step-status");
  if (done) status.innerHTML = ICONS.check;
  else status.textContent = { "step-monarch": "1", "step-plkey": "2", "step-mapping": "3" }[stepId];
}
$("step-monarch-btn").addEventListener("click", () => chrome.tabs.create({ url: "https://app.monarch.com" }));
$("step-plkey-btn").addEventListener("click", () => { selectTab("settings"); $("pl-api-key").focus(); });
$("step-mapping-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());

// ─── Settings — load & auto-detect Monarch ──────────────────────────────────
chrome.storage.sync.get(["plApiKey"], ({ plApiKey }) => {
  if (plApiKey) { $("pl-api-key").value = plApiKey; setSavedStatus("pl-saved-status", true); }

  testMonarchConnection();

  checkSetupComplete();
  updateLastSyncLabel();
  updateMappingSummary();
  maybeShowRatePrompt();
});
$("pl-api-key").addEventListener("input", () => setSavedStatus("pl-saved-status", false));

// ─── Monarch connection test ────────────────────────────────────────────────
async function testMonarchConnection() {
  setMonarchStatus(false, "checking…");
  const result = await chrome.runtime.sendMessage({ type: "VALIDATE_MONARCH_TOKEN" });
  if (result.success) {
    setMonarchStatus(true, "✓ connected");
    showCardAlert("monarch-alert", `✓ Connected to Monarch (${result.accounts.length} accounts found)`, "success");
  } else {
    setMonarchStatus(false, "not connected");
    showCardAlert("monarch-alert", "Open app.monarch.com in a tab and log in, then try again.", "error");
  }
  checkSetupComplete();
}

// ─── Settings — Monarch ───────────────────────────────────────────────────────
$("test-monarch-btn").addEventListener("click", async () => {
  const btn = $("test-monarch-btn");
  setLoading(btn, true, "Testing");
  clearCardAlert("monarch-alert");
  await testMonarchConnection();
  setLoading(btn, false);
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
  const result = await callProjectionLab("getAccounts", { key });
  setLoading(btn, false);
  if (result.success) {
    const v = result.result?.apiVersion === 2 ? "v5" : "v4";
    const n = PLAccounts.buildTargets(result.result).length;
    showCardAlert("pl-alert", `✓ Connected to ProjectionLab ${v} (${n} accounts found)`, "success");
  }
  else if (result.error?.includes("No ProjectionLab")) showCardAlert("pl-alert", "Open app.projectionlab.com or ea.projectionlab.com in a tab first.", "error");
  else showCardAlert("pl-alert", result.error || "Connection failed.", "error");
});

// ─── Sync tab ─────────────────────────────────────────────────────────────────
function checkSetupComplete() {
  chrome.storage.sync.get(["plApiKey", "accountMapping"], (data) => {
    const hasKey = Boolean(data.plApiKey);
    const hasMapping = data.accountMapping?.length > 0;
    const ready = monarchConnected && hasKey && hasMapping;

    setStepDone("step-monarch", monarchConnected);
    setStepDone("step-plkey", hasKey);
    setStepDone("step-mapping", hasMapping);

    $("setup-required").style.display = ready ? "none" : "block";
    $("sync-ready").style.display     = ready ? "block" : "none";

    if (ready && !autoPreviewDone) {
      autoPreviewDone = true;
      loadPreview();
    }
  });
}

// ─── "No PL tab" helper ──────────────────────────────────────────────────────
function plErrorStatus(prefix, error) {
  const message = `${prefix}: ${error || "Open app.projectionlab.com in a tab."}`;
  if (error?.includes("No ProjectionLab")) {
    showStatus("status-bar", "ProjectionLab isn't open in any tab. Open it, then come back here.", "warning", {
      label: "Open ProjectionLab",
      onClick: () => chrome.tabs.create({ url: "https://app.projectionlab.com" }),
    });
  } else {
    showStatus("status-bar", message, "error");
  }
}

// ─── Preview with checkboxes ─────────────────────────────────────────────────
async function loadPreview() {
  const btn = $("preview-btn");
  clearStatus("status-bar");
  setLoading(btn, true, "Loading");

  const previewUnavailable = () => {
    $("preview-area").innerHTML = `<p class="empty-state">Preview unavailable — fix the issue above, then refresh.</p>`;
    setLoading(btn, false);
  };

  const { plApiKey, accountMapping } = await getStoredCredentials();
  if (!plApiKey || !accountMapping?.length) {
    showStatus("status-bar", "Complete Settings and Account Mapping first.", "error");
    previewUnavailable();
    return;
  }

  const mResult = await chrome.runtime.sendMessage({ type: "FETCH_MONARCH_ACCOUNTS" });
  if (!mResult.success) {
    showStatus("status-bar", `Monarch: ${mResult.error}`, "error");
    previewUnavailable();
    return;
  }

  const plResult = await callProjectionLab("getAccounts", { key: plApiKey });
  if (!plResult.success) {
    plErrorStatus("ProjectionLab", plResult.error);
    previewUnavailable();
    return;
  }

  const plApiVersion = plResult.result?.apiVersion ?? 1;
  // Build with every V4 loan field visible so existing links always resolve.
  const targets = PLAccounts.buildTargets(plResult.result);

  // Migrate links saved against the legacy (V4) API, persisting what resolves cleanly.
  const { mapping, changed, issues } =
    PLAccounts.migrateMapping(accountMapping, targets, plApiVersion, mResult.accounts);
  if (changed) await new Promise(r => chrome.storage.sync.set({ accountMapping: mapping }, r));

  previewData = [];
  const unresolved = [];
  for (const m of mapping) {
    const mAcc = mResult.accounts.find(a => a.id === m.monarchId);
    const target = targets.find(t => t.vid === PLAccounts.vidOf(m.plId, m.plField));
    if (!mAcc || !target) { unresolved.push(mAcc?.name ?? m.monarchId); continue; }
    const oldBalance = target.balance ?? 0;
    const hasChanged = Math.abs(mAcc.balance - oldBalance) >= 0.01;
    previewData.push({
      monarchId: mAcc.id,
      plId: target.plId,
      plField: target.plField,
      plApiVersion,
      fieldLabel: target.fieldLabel || "",
      name: mAcc.name,
      plName: target.name,
      oldBalance,
      newBalance: mAcc.balance,
      hasChanged,
      selected: hasChanged,
    });
  }

  renderPreview();
  setLoading(btn, false);
  updateSyncButtonState();
  if (unresolved.length || issues.length) {
    const n = unresolved.length;
    showStatus("status-bar",
      `${n} linked account${n !== 1 ? "s" : ""} couldn't be matched in ProjectionLab (${unresolved.slice(0, 3).join(", ")}${n > 3 ? "…" : ""}). Re-link ${n !== 1 ? "them" : "it"} in Account Mapping.`,
      "warning", { label: "Open Account Mapping", onClick: () => chrome.runtime.openOptionsPage() });
  } else if (changed) {
    showStatus("status-bar", "✓ Updated your links for the new ProjectionLab version.", "success");
  }
}
$("preview-btn").addEventListener("click", loadPreview);

$("hide-unchanged")?.addEventListener("change", () => renderPreview());

function visibleRows() {
  const hideUnchanged = $("hide-unchanged")?.checked ?? false;
  return hideUnchanged ? previewData.filter(r => r.hasChanged) : previewData;
}

function renderPreview() {
  const area = $("preview-area");
  const visible = visibleRows();

  if (previewData.length === 0) {
    area.innerHTML = `<p class="empty-state">No mapped accounts found.</p>`;
    return;
  }
  if (visible.length === 0) {
    const unchangedCount = previewData.filter(r => !r.hasChanged).length;
    area.innerHTML = `<p class="empty-state">All ${pluralAccounts(unchangedCount)} up to date — nothing to sync! ✓</p>`;
    updateSyncButtonState();
    return;
  }

  const rows = visible.map((row) => {
    const realIdx = previewData.indexOf(row);
    const diff = row.newBalance - row.oldBalance;
    const diffStr = diff === 0 ? "" : ` <span style="color:${diff > 0 ? "#4ade80" : "#f87171"}">${diff > 0 ? "+" : ""}${formatBalance(diff)}</span>`;
    const checked = row.selected ? "checked" : "";
    const rowCls = !row.selected ? "row-disabled" : "";
    const target = `→ ${escHtml(row.plName)}${row.fieldLabel ? ` · ${row.fieldLabel}` : ""}`;
    return `<tr class="${rowCls}" data-row="${realIdx}">
      <td class="cb-cell"><input type="checkbox" class="sync-cb" data-idx="${realIdx}" ${checked} /></td>
      <td>${escHtml(row.name)}<div class="acct-target">${target}</div></td>
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
      $("select-all-cb").checked = visibleRows().every(r => r.selected);
    });
  });

  // Select-all checkbox
  $("select-all-cb")?.addEventListener("change", (e) => {
    for (const row of visibleRows()) row.selected = e.target.checked;
    renderPreview();
    updateSyncButtonState();
  });
}

function updateSyncButtonState() {
  const selectedCount = previewData.filter(r => r.selected).length;
  $("sync-btn").disabled = syncInProgress || selectedCount === 0;
  setBtn($("sync-btn"), "zap", selectedCount > 0 ? `Sync Selected (${selectedCount})` : "Sync Selected");
}

// Per-row sync progress: swap the row's checkbox cell for a status icon
function setRowStatus(idx, state) {
  const tr = document.querySelector(`tr[data-row="${idx}"]`);
  if (!tr) return;
  const cell = tr.querySelector(".cb-cell");
  const icons = { busy: ICONS.spinner, ok: ICONS.check, err: ICONS.x };
  cell.innerHTML = `<span class="row-status ${state}">${icons[state]}</span>`;
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

  syncInProgress = true;
  setLoading(btn, true, "Syncing");
  clearStatus("status-bar");

  let successCount = 0;
  const errors = [];
  for (const row of toSync) {
    const idx = previewData.indexOf(row);
    setRowStatus(idx, "busy");
    const result = await callProjectionLab("updateValue", {
      key: plApiKey, accountId: row.plId, field: row.plField, value: row.newBalance, expectVersion: row.plApiVersion,
    });
    if (result.success) { successCount++; setRowStatus(idx, "ok"); }
    else { errors.push(`${row.name}: ${result.error}`); setRowStatus(idx, "err"); }
  }

  syncInProgress = false;
  setLoading(btn, false);
  if (errors.length === 0) {
    showStatus("status-bar", `✓ Synced ${pluralAccounts(successCount)} successfully!`, "success");
    chrome.storage.sync.set({ lastSync: new Date().toISOString() }, updateLastSyncLabel);
    for (const row of toSync) {
      row.oldBalance = row.newBalance;
      row.hasChanged = false;
      row.selected = false;
    }
    recordSuccessfulSync();
    renderPreview();
    updateSyncButtonState();
  } else if (errors.length < toSync.length) {
    showStatus("status-bar", `⚠ ${successCount} synced, ${errors.length} failed: ${errors[0]}`, "error");
  } else {
    plErrorStatus("All updates failed", errors[0]);
  }
});

// ─── Rate prompt ─────────────────────────────────────────────────────────────
function maybeShowRatePrompt() {
  chrome.storage.sync.get(["syncCount", "rateDismissed"], ({ syncCount = 0, rateDismissed }) => {
    if (syncCount >= RATE_PROMPT_MIN_SYNCS && !rateDismissed) {
      $("rate-prompt").classList.add("visible");
    }
  });
}
function recordSuccessfulSync() {
  chrome.storage.sync.get(["syncCount"], ({ syncCount = 0 }) => {
    chrome.storage.sync.set({ syncCount: syncCount + 1 }, maybeShowRatePrompt);
  });
}
$("rate-btn").addEventListener("click", () => {
  chrome.storage.sync.set({ rateDismissed: true });
  chrome.tabs.create({ url: STORE_REVIEW_URL });
});
$("rate-dismiss").addEventListener("click", () => {
  chrome.storage.sync.set({ rateDismissed: true });
  $("rate-prompt").classList.remove("visible");
});

// ─── ProjectionLab ────────────────────────────────────────────────────────────
function callProjectionLab(action, payload) {
  return chrome.runtime.sendMessage({ type: "CALL_PL", action, payload });
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function getStoredCredentials() {
  return new Promise(resolve => chrome.storage.sync.get(["plApiKey", "accountMapping"], resolve));
}
