// options.js

// ─── State ───────────────────────────────────────────────────────────────────
let monarchAccounts = [];
let plAccounts      = [];
let mapping         = [];
let assetHasLoan    = {}; // { [plAssetId]: boolean } — persisted in chrome.storage
let rawPlToday      = null; // cached for rebuild after loan toggle

let selectedM  = null;
let selectedPL = null;

// Filter / sort state
let mSearch = "", mFilter = "all", mSort = "name";
let plSearch = "", plFilter = "all", plSort = "name";
let linksSearch = "", linksSortCol = null, linksSortDir = "asc";

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showStatus(msg, type) {
  const el = $("status-bar");
  el.className = "status-bar " + type;
  el.textContent = msg;
  if (type === "success") setTimeout(() => { el.className = "status-bar"; el.textContent = ""; }, 3000);
}

// ─── Page nav ─────────────────────────────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $("page-" + btn.dataset.page).classList.add("active");
    if (btn.dataset.page === "manage") renderLinksTable();
  });
});

// ─── Load buttons ─────────────────────────────────────────────────────────────
$("load-monarch-btn").addEventListener("click", loadMonarch);
$("load-pl-btn").addEventListener("click",      loadPL);
$("load-both-btn").addEventListener("click",    () => { loadMonarch(); loadPL(); });

async function loadMonarch() {
  const btn = $("load-monarch-btn");
  btn.disabled = true; btn.innerHTML = '<span class="spinner">⏳</span> Loading…';

  // Try cookie-based auth first, fall back to saved token
  let result = await chrome.runtime.sendMessage({ type: "FETCH_MONARCH_ACCOUNTS" });
  if (!result.success) {
    const { monarchToken } = await getStorage(["monarchToken"]);
    if (monarchToken) {
      result = await chrome.runtime.sendMessage({ type: "FETCH_MONARCH_ACCOUNTS", token: monarchToken });
    }
  }

  btn.disabled = false; btn.innerHTML = '<span style="color:#a855f7">◉</span> Load Monarch';
  if (!result.success) { showStatus("Monarch: " + (result.error || "Log into app.monarch.com in this browser."), "error"); return; }
  monarchAccounts = result.accounts;
  buildMonarchFilterPills();
  renderMonarchList();
}

async function loadPL() {
  const btn = $("load-pl-btn");
  btn.disabled = true; btn.innerHTML = '<span class="spinner">⏳</span> Loading…';
  const { plApiKey } = await getStorage(["plApiKey"]);
  if (!plApiKey) {
    showStatus("ProjectionLab key not saved. Go back to the extension popup → Settings.", "error");
    btn.disabled = false; btn.innerHTML = '<span style="color:#38bdf8">◉</span> Load ProjectionLab';
    return;
  }
  const result = await chrome.runtime.sendMessage({ type: "CALL_PL", action: "exportData", payload: { key: plApiKey } });
  btn.disabled = false; btn.innerHTML = '<span style="color:#38bdf8">◉</span> Load ProjectionLab';
  if (!result.success) { showStatus("ProjectionLab: " + (result.error || "Open app.projectionlab.com or ea.projectionlab.com in a tab."), "error"); return; }

  rawPlToday = result.result?.today || {};
  buildPlAccounts(rawPlToday);
  buildPlFilterPills();
  renderPlList();
}

function buildPlAccounts(today) {
  const expandedAssets = [];
  for (const a of (today.assets || [])) {
    const hasAmount  = a.amount  != null;
    const hasBalance = a.balance != null;
    const isDual     = hasAmount && hasBalance;
    const showLoan   = isDual && assetHasLoan[a.id] !== false;

    // Primary/value entry
    expandedAssets.push({
      ...a,
      _plType: "Asset",
      _plField: hasAmount ? "amount" : "balance",
      _vid: a.id + ":" + (hasAmount ? "amount" : "balance"),
      balance: hasAmount ? a.amount : a.balance,
      _isDual: isDual,
      ...(showLoan ? { _fieldLabel: "value" } : {}),
    });

    // Loan entry — only shown when the asset has both fields and user hasn't disabled it
    if (showLoan) {
      expandedAssets.push({
        ...a, _plType: "Asset", _plField: "balance", _vid: a.id + ":balance",
        balance: a.balance, _fieldLabel: "loan",
      });
    }
  }

  plAccounts = [
    ...(today.savingsAccounts    || []).map(a => ({...a, _plType: "Savings",    _plField: "balance", _vid: a.id + ":balance"})),
    ...(today.investmentAccounts || []).map(a => ({...a, _plType: "Investment", _plField: "balance", _vid: a.id + ":balance"})),
    ...expandedAssets,
    ...(today.debts              || []).map(a => ({...a, _plType: "Debt",       _plField: "balance", _vid: a.id + ":balance"})),
  ];
}

// ─── Filter pills ──────────────────────────────────────────────────────────────
function buildMonarchFilterPills() {
  const types = [...new Set(monarchAccounts.map(a => a.type).filter(Boolean))].sort();
  const container = $("m-filter-pills").querySelector(".filter-pills");
  container.innerHTML = `<button class="pill active" data-filter="all">All</button>`;
  // Friendly groupings
  const groups = {
    "Checking / Savings": a => ["checking","savings","cash"].some(k => (a.type+a.subtype).toLowerCase().includes(k)),
    "Credit Cards":       a => (a.type+a.subtype).toLowerCase().includes("credit"),
    "Investments":        a => ["investment","brokerage","retirement","401","ira","crypto"].some(k => (a.type+a.subtype).toLowerCase().includes(k)),
    "Loans":              a => ["loan","mortgage","student"].some(k => (a.type+a.subtype).toLowerCase().includes(k)),
    "Property":           a => ["property","real estate","vehicle","car"].some(k => (a.type+a.subtype).toLowerCase().includes(k)),
  };
  // Only show groups that have at least one match
  Object.entries(groups).forEach(([label, test]) => {
    if (monarchAccounts.some(test)) {
      const btn = document.createElement("button");
      btn.className = "pill"; btn.dataset.filter = label; btn.textContent = label;
      container.appendChild(btn);
    }
  });
  // Add raw types that didn't match any group
  types.forEach(type => {
    const matched = Object.values(groups).some(fn =>
      monarchAccounts.filter(a => a.type === type).some(fn)
    );
    if (!matched) {
      const btn = document.createElement("button");
      btn.className = "pill"; btn.dataset.filter = "type:" + type; btn.textContent = type;
      container.appendChild(btn);
    }
  });
  container.querySelectorAll(".pill").forEach(p => {
    p.addEventListener("click", () => {
      container.querySelectorAll(".pill").forEach(x => x.classList.remove("active"));
      p.classList.add("active");
      mFilter = p.dataset.filter;
      renderMonarchList();
    });
  });
}

function buildPlFilterPills() {
  const container = $("pl-filter-pills");
  container.innerHTML = `<button class="pill active" data-filter="all">All</button>`;
  ["Savings","Investment","Asset","Debt"].forEach(type => {
    if (plAccounts.some(a => a._plType === type)) {
      const btn = document.createElement("button");
      btn.className = "pill"; btn.dataset.filter = type; btn.textContent = type;
      container.appendChild(btn);
    }
  });
  container.querySelectorAll(".pill").forEach(p => {
    p.addEventListener("click", () => {
      container.querySelectorAll(".pill").forEach(x => x.classList.remove("active"));
      p.classList.add("active");
      plFilter = p.dataset.filter;
      renderPlList();
    });
  });
}

// ─── Render account lists ──────────────────────────────────────────────────────
const GROUPS = {
  "Checking / Savings": a => ["checking","savings","cash"].some(k => (a.type+a.subtype).toLowerCase().includes(k)),
  "Credit Cards":       a => (a.type+a.subtype).toLowerCase().includes("credit"),
  "Investments":        a => ["investment","brokerage","retirement","401","ira","crypto"].some(k => (a.type+a.subtype).toLowerCase().includes(k)),
  "Loans":              a => ["loan","mortgage","student"].some(k => (a.type+a.subtype).toLowerCase().includes(k)),
  "Property":           a => ["property","real estate","vehicle","car"].some(k => (a.type+a.subtype).toLowerCase().includes(k)),
};

function filterMonarch(a) {
  if (mSearch && !a.name.toLowerCase().includes(mSearch.toLowerCase())) return false;
  if (mFilter === "all") return true;
  if (mFilter.startsWith("type:")) return a.type === mFilter.slice(5);
  const fn = GROUPS[mFilter];
  return fn ? fn(a) : true;
}

function filterPL(a) {
  if (plSearch && !a.name.toLowerCase().includes(plSearch.toLowerCase())) return false;
  if (plFilter === "all") return true;
  return a._plType === plFilter;
}

function sortAccounts(arr, sortKey) {
  return [...arr].sort((a, b) => {
    if (sortKey === "balance-desc") return (b.balance ?? 0) - (a.balance ?? 0);
    if (sortKey === "balance-asc")  return (a.balance ?? 0) - (b.balance ?? 0);
    if (sortKey === "type")         return (a.type ?? "").localeCompare(b.type ?? "");
    if (sortKey === "institution")  return (a.institution ?? "").localeCompare(b.institution ?? "");
    return a.name.localeCompare(b.name); // default: name
  });
}

function mappedMIds()  { return new Set(mapping.map(m => m.monarchId)); }
function mappedPLIds() { return new Set(mapping.map(m => m.plId + ":" + (m.plField ?? "balance"))); }

function renderMonarchList() {
  const list    = $("m-list");
  const mapped  = mappedMIds();
  const visible = sortAccounts(monarchAccounts.filter(filterMonarch), mSort);
  $("m-count").textContent = `${monarchAccounts.length} accounts`;

  if (monarchAccounts.length === 0) {
    list.innerHTML = `<div class="acct-empty">Click "Load Monarch" to fetch accounts</div>`; return;
  }
  if (visible.length === 0) {
    list.innerHTML = `<div class="acct-empty">No accounts match the current filter</div>`; return;
  }

  list.innerHTML = visible.map(a => {
    const isLinked   = mapped.has(a.id);
    const isSelected = a.id === selectedM;
    const cls = ["acct-item", isLinked ? "linked" : "", isSelected ? "sel-m" : ""].filter(Boolean).join(" ");
    const tags = [
      a.type     ? `<span class="tag tag-type">${esc(a.type)}${a.subtype ? " · " + esc(a.subtype) : ""}</span>` : "",
      a.institution ? `<span class="tag tag-inst">${esc(a.institution)}</span>` : "",
      isLinked   ? `<span class="tag tag-linked">linked</span>` : "",
    ].filter(Boolean).join("");
    return `
      <div class="${cls}" data-id="${esc(a.id)}">
        <div class="acct-item-row">
          <span class="acct-item-name">${esc(a.name)}</span>
          <span class="acct-item-balance">${fmt(a.balance)}</span>
        </div>
        <div class="acct-item-tags">${tags}</div>
      </div>`;
  }).join("");

  list.querySelectorAll(".acct-item:not(.linked)").forEach(el => {
    el.addEventListener("click", () => {
      selectedM = selectedM === el.dataset.id ? null : el.dataset.id;
      renderMonarchList();
      updateConnector();
    });
  });
}

function renderPlList() {
  const list    = $("pl-list");
  const mapped  = mappedPLIds();
  const visible = sortAccounts(plAccounts.filter(filterPL), plSort);
  $("pl-count").textContent = `${plAccounts.length} accounts`;

  if (plAccounts.length === 0) {
    list.innerHTML = `<div class="acct-empty">Click "Load ProjectionLab" to fetch accounts</div>`; return;
  }
  if (visible.length === 0) {
    list.innerHTML = `<div class="acct-empty">No accounts match the current filter</div>`; return;
  }

  list.innerHTML = visible.map(a => {
    const vid        = a._vid ?? a.id;
    const isLinked   = mapped.has(vid);
    const isSelected = vid === selectedPL;
    const cls = ["acct-item", isLinked ? "linked" : "", isSelected ? "sel-pl" : ""].filter(Boolean).join(" ");
    const loanToggle = (a._isDual && a._plField === "amount")
      ? `<label class="loan-toggle"><input type="checkbox" class="loan-cb" data-asset-id="${esc(a.id)}" ${assetHasLoan[a.id] !== false ? "checked" : ""}> loan</label>`
      : "";
    const tags = [
      a._plType     ? `<span class="tag tag-type">${esc(a._plType)}</span>` : "",
      a._fieldLabel ? `<span class="tag tag-field">${esc(a._fieldLabel)}</span>` : "",
      isLinked      ? `<span class="tag tag-linked">linked</span>` : "",
      loanToggle,
    ].filter(Boolean).join("");
    return `
      <div class="${cls}" data-id="${esc(vid)}">
        <div class="acct-item-row">
          <span class="acct-item-name">${esc(a.name)}</span>
          <span class="acct-item-balance">${fmt(a.balance)}</span>
        </div>
        <div class="acct-item-tags">${tags}</div>
      </div>`;
  }).join("");

  list.querySelectorAll(".acct-item:not(.linked)").forEach(el => {
    el.addEventListener("click", () => {
      selectedPL = selectedPL === el.dataset.id ? null : el.dataset.id;
      renderPlList();
      updateConnector();
    });
  });

  list.querySelectorAll(".loan-toggle").forEach(label => {
    label.addEventListener("click", e => e.stopPropagation());
  });
  list.querySelectorAll(".loan-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      assetHasLoan[cb.dataset.assetId] = cb.checked;
      chrome.storage.sync.set({ assetHasLoan });
      if (rawPlToday) { buildPlAccounts(rawPlToday); renderPlList(); }
    });
  });
}

// ─── Connector ────────────────────────────────────────────────────────────────
function updateConnector() {
  const indicator = $("connect-indicator");
  const btn       = $("connect-btn");
  const hint      = $("connector-hint");
  const selHint   = $("selection-hint");

  const mAcc  = monarchAccounts.find(a => a.id === selectedM);
  const plAcc = plAccounts.find(a => (a._vid ?? a.id) === selectedPL);

  if (mAcc && plAcc) {
    indicator.style.display = "none";
    btn.classList.add("visible");
    hint.innerHTML = `<span style="color:#c4b5fd">${esc(mAcc.name)}</span><br>→<br><span style="color:#7dd3fc">${esc(plAcc.name)}</span>`;
    selHint.textContent = "";
  } else {
    indicator.style.display = "";
    btn.classList.remove("visible");
    hint.textContent = "";
    if (mAcc && !plAcc) selHint.textContent = "Now select a ProjectionLab account →";
    else if (!mAcc && plAcc) selHint.textContent = "← Now select a Monarch account";
    else selHint.textContent = "";
  }
}

$("connect-btn").addEventListener("click", () => {
  if (!selectedM || !selectedPL) return;

  // Parse virtual ID into real plId and plField
  const colonIdx = selectedPL.lastIndexOf(":");
  const plId    = colonIdx >= 0 ? selectedPL.slice(0, colonIdx) : selectedPL;
  const plField = colonIdx >= 0 ? selectedPL.slice(colonIdx + 1) : "balance";

  if (mapping.some(m => m.monarchId === selectedM)) {
    showStatus("This Monarch account is already linked. Unlink it first in Manage Links.", "warning"); return;
  }
  if (mapping.some(m => m.plId === plId && (m.plField ?? "balance") === plField)) {
    showStatus("This ProjectionLab field is already linked. Unlink it first in Manage Links.", "warning"); return;
  }
  mapping.push({ monarchId: selectedM, plId, plField });
  saveMapping();
  selectedM = null; selectedPL = null;
  renderMonarchList(); renderPlList(); updateConnector();
  showStatus("✓ Link saved.", "success");
});

// ─── Auto-Link by Name ───────────────────────────────────────────────────────
$("auto-link-btn").addEventListener("click", () => {
  if (monarchAccounts.length === 0 || plAccounts.length === 0) {
    showStatus("Load both Monarch and ProjectionLab accounts first.", "warning");
    return;
  }

  const mappedM  = mappedMIds();
  const mappedPL = mappedPLIds();
  let linked = 0;

  for (const mAcc of monarchAccounts) {
    if (mappedM.has(mAcc.id)) continue;
    const normalizedM = mAcc.name.trim().toLowerCase();

    for (const plAcc of plAccounts) {
      const vid = plAcc._vid ?? plAcc.id;
      if (mappedPL.has(vid)) continue;
      if (plAcc.name.trim().toLowerCase() === normalizedM) {
        mapping.push({ monarchId: mAcc.id, plId: plAcc.id, plField: plAcc._plField ?? "balance" });
        mappedM.add(mAcc.id);
        mappedPL.add(vid);
        linked++;
        break;
      }
    }
  }

  if (linked > 0) {
    saveMapping();
    renderMonarchList();
    renderPlList();
    updateConnector();
    showStatus(`✓ Auto-linked ${linked} account${linked !== 1 ? "s" : ""} by matching name.`, "success");
  } else {
    showStatus("No unlinked accounts with matching names found.", "info");
  }
});

// ─── Search & Sort ────────────────────────────────────────────────────────────
$("m-search").addEventListener("input",  e => { mSearch  = e.target.value; renderMonarchList(); });
$("pl-search").addEventListener("input", e => { plSearch = e.target.value; renderPlList(); });
$("m-sort").addEventListener("change",  e => { mSort  = e.target.value; renderMonarchList(); });
$("pl-sort").addEventListener("change", e => { plSort = e.target.value; renderPlList(); });

// ─── Manage Links table ───────────────────────────────────────────────────────
function renderLinksTable() {
  const container = $("links-container");
  const search = linksSearch.toLowerCase();

  let visible = mapping.map((m, i) => {
    const mAcc  = monarchAccounts.find(a => a.id === m.monarchId);
    const vid   = m.plId + ":" + (m.plField ?? "balance");
    const plAcc = plAccounts.find(a => (a._vid ?? a.id) === vid);
    return { i, m, mAcc, plAcc,
      mName:  mAcc?.name  ?? m.monarchId,
      plName: plAcc?.name ?? m.plId,
      mType:  mAcc?.type  ?? "",
      mInst:  mAcc?.institution ?? "",
    };
  }).filter(r => !search || r.mName.toLowerCase().includes(search) || r.plName.toLowerCase().includes(search));

  if (linksSortCol) {
    visible.sort((a, b) => {
      let av = a[linksSortCol] ?? "", bv = b[linksSortCol] ?? "";
      return linksSortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  $("links-count").textContent = `${mapping.length} link${mapping.length !== 1 ? "s" : ""}`;

  if (mapping.length === 0) {
    container.innerHTML = `<div class="links-empty">No account links saved yet.<br>Go to "Link Accounts" to create some.</div>`;
    return;
  }

  const sortIcon = col => {
    if (linksSortCol !== col) return `<span class="sort-icon"></span>`;
    return `<span class="sort-icon ${linksSortDir}"></span>`;
  };

  container.innerHTML = `
    <table class="links-table">
      <thead>
        <tr>
          <th class="sortable" data-col="mName">Monarch Account ${sortIcon("mName")}</th>
          <th class="sortable" data-col="mType">Type ${sortIcon("mType")}</th>
          <th style="width:32px"></th>
          <th class="sortable" data-col="plName">ProjectionLab Account ${sortIcon("plName")}</th>
          <th style="width:80px"></th>
        </tr>
      </thead>
      <tbody>
        ${visible.map(r => `
          <tr>
            <td>
              <div class="link-m-name">${esc(r.mName)}</div>
              ${r.mInst ? `<div class="link-m-sub">${esc(r.mInst)}</div>` : ""}
            </td>
            <td><span class="tag tag-type">${esc(r.mType)}</span></td>
            <td class="link-arrow">→</td>
            <td>
              <div class="link-pl-name">${esc(r.plName)}</div>
              ${(r.plAcc?._plType || r.plAcc?._fieldLabel) ? `<div class="link-pl-sub">${[r.plAcc?._plType, r.plAcc?._fieldLabel].filter(Boolean).map(esc).join(" · ")}</div>` : ""}
            </td>
            <td>
              <button class="unlink-btn" data-index="${r.i}">Unlink</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  // Sort headers
  container.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (linksSortCol === col) linksSortDir = linksSortDir === "asc" ? "desc" : "asc";
      else { linksSortCol = col; linksSortDir = "asc"; }
      renderLinksTable();
    });
  });

  // Unlink buttons
  container.querySelectorAll(".unlink-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      mapping.splice(idx, 1);
      saveMapping();
      renderLinksTable();
      renderMonarchList();
      renderPlList();
      showStatus("Link removed.", "success");
    });
  });
}

$("links-search").addEventListener("input", e => { linksSearch = e.target.value; renderLinksTable(); });

$("clear-all-btn").addEventListener("click", () => {
  if (!confirm(`Remove all ${mapping.length} link(s)?`)) return;
  mapping = [];
  saveMapping();
  renderLinksTable();
  renderMonarchList();
  renderPlList();
  showStatus("All links cleared.", "success");
});

// ─── Persistence ──────────────────────────────────────────────────────────────
function saveMapping() {
  chrome.storage.sync.set({ accountMapping: mapping });
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function getStorage(keys) {
  return new Promise(r => chrome.storage.sync.get(keys, r));
}
function esc(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function fmt(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(n);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
chrome.storage.sync.get(["accountMapping", "assetHasLoan"], ({ accountMapping, assetHasLoan: ahl }) => {
  if (accountMapping?.length) mapping = accountMapping;
  if (ahl) assetHasLoan = ahl;
  renderLinksTable();
});
