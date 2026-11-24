// pl-accounts.js — Shared by popup.js and options.js (loaded via <script> before them).
//
// Normalizes ProjectionLab accounts from either Plugin API contract into a flat list of
// "sync targets" (one per writable monetary field), and migrates saved V4 mappings to V5.
//
//   V4 (legacy, api.version absent): exportData().today.{savingsAccounts, investmentAccounts, assets, debts}
//        assets carry `amount` (market value) and optionally `balance` (attached loan)
//   V5 (api.version === 2):          getAccounts() → [{ id, name, kind, type, subtype, ... }]
//        kind "account" → balance, kind "debt" → balance (positive = owed, optional securedByAssetId),
//        kind "real-asset" → value. Loans are separate debt records.
//
// Target shape:
//   { vid, plId, plField, name, plType, typeLabel, fieldLabel, balance, kind, securedByAssetId, isDual }
//   `balance` is the current value of `plField` (named `balance` so shared sort/format code works).

const PLAccounts = (() => {
  const vidOf = (plId, plField) => `${plId}:${plField ?? "balance"}`;

  function buildTargets(res, { assetHasLoan = {} } = {}) {
    if (!res) return [];
    return res.apiVersion === 2 ? buildV5(res.accounts || []) : buildV4(res.today || {}, assetHasLoan);
  }

  function buildV5(accounts) {
    const byId = Object.fromEntries(accounts.map(a => [a.id, a]));
    return accounts.map(a => {
      const typeLabel = [a.type, a.subtype].filter(Boolean).join(" · ");
      const base = { plId: a.id, name: a.name ?? "(unnamed)", kind: a.kind, typeLabel };
      if (a.kind === "real-asset") {
        return { ...base, plType: "Asset", plField: "value", balance: a.value, vid: vidOf(a.id, "value") };
      }
      if (a.kind === "debt") {
        const collateral = a.securedByAssetId ? byId[a.securedByAssetId] : null;
        return {
          ...base, plType: "Debt", plField: "balance", balance: a.balance, vid: vidOf(a.id, "balance"),
          securedByAssetId: a.securedByAssetId,
          fieldLabel: a.securedByAssetId ? (collateral ? `loan on ${collateral.name}` : "secured loan") : "",
        };
      }
      if (a.kind === "account") {
        return { ...base, plType: "Account", plField: "balance", balance: a.balance, vid: vidOf(a.id, "balance") };
      }
      // Unknown future kind: pick whichever native field it exposes.
      const field = a.value != null && a.balance == null ? "value" : "balance";
      return { ...base, plType: a.kind || "Other", plField: field, balance: a[field], vid: vidOf(a.id, field) };
    });
  }

  function buildV4(today, assetHasLoan) {
    const simple = (arr, plType) => (arr || []).map(a => ({
      plId: a.id, name: a.name, plType, plField: "balance", balance: a.balance, vid: vidOf(a.id, "balance"),
    }));
    const assets = [];
    for (const a of (today.assets || [])) {
      const hasAmount = a.amount != null;
      const isDual = hasAmount && a.balance != null;
      const showLoan = isDual && assetHasLoan[a.id] !== false;
      const field = hasAmount ? "amount" : "balance";
      assets.push({
        plId: a.id, name: a.name, plType: "Asset", plField: field, balance: a[field],
        vid: vidOf(a.id, field), isDual, fieldLabel: showLoan ? "value" : "",
      });
      if (showLoan) {
        assets.push({
          plId: a.id, name: a.name, plType: "Asset", plField: "balance", balance: a.balance,
          vid: vidOf(a.id, "balance"), fieldLabel: "loan",
        });
      }
    }
    return [
      ...simple(today.savingsAccounts, "Savings"),
      ...simple(today.investmentAccounts, "Investment"),
      ...assets,
      ...simple(today.debts, "Debt"),
    ];
  }

  const looksLikeLiability = mAcc =>
    /loan|mortgage|credit|liabilit|debt|heloc/i.test(`${mAcc?.type ?? ""} ${mAcc?.subtype ?? ""}`);

  // Rewrite saved V4 links ({ monarchId, plId, plField }) so they point at V5 targets.
  // Returns { mapping, changed, issues: [{ monarchId, plId, reason }] }. Never drops links:
  // anything that can't be resolved unambiguously is kept as-is and reported so the user can re-link.
  function migrateMapping(mapping, targets, apiVersion, monarchAccounts = []) {
    const issues = [];
    if (apiVersion !== 2) return { mapping, changed: false, issues };

    const byVid = new Map(targets.map(t => [t.vid, t]));
    const kindById = new Map(targets.map(t => [t.plId, t.kind]));
    const taken = new Set(mapping.map(m => vidOf(m.plId, m.plField)).filter(v => byVid.has(v)));
    let changed = false;

    const next = mapping.map(m => {
      if (byVid.has(vidOf(m.plId, m.plField))) return m; // already valid

      const kind = kindById.get(m.plId);
      const mAcc = monarchAccounts.find(a => a.id === m.monarchId);
      let newVid = null;

      if (!kind) {
        issues.push({ ...m, reason: "missing" }); // archived/deleted in ProjectionLab
        return m;
      }

      if (kind === "real-asset") {
        // V4 `amount` was the market value. V4 `balance` on an asset was either its attached loan
        // (dual-field) or its value (single-field) — decide using the Monarch side.
        const wantsLoan = m.plField === "balance" && looksLikeLiability(mAcc);
        if (m.plField === "balance" && !mAcc) { issues.push({ ...m, reason: "needs-monarch" }); return m; }
        if (wantsLoan) {
          const debts = targets.filter(t => t.kind === "debt" && t.securedByAssetId === m.plId);
          if (debts.length !== 1) {
            issues.push({ ...m, reason: debts.length ? "ambiguous-loan" : "loan-not-found" });
            return m;
          }
          newVid = debts[0].vid;
        } else {
          newVid = vidOf(m.plId, "value");
        }
      } else {
        newVid = vidOf(m.plId, "balance");
      }

      const target = byVid.get(newVid);
      if (!target || taken.has(newVid)) {
        issues.push({ ...m, reason: target ? "duplicate" : "missing" });
        return m;
      }
      taken.add(newVid);
      changed = true;
      return { monarchId: m.monarchId, plId: target.plId, plField: target.plField };
    });

    return { mapping: next, changed, issues };
  }

  const ISSUE_TEXT = {
    "missing":         "ProjectionLab account no longer exists (archived or deleted)",
    "ambiguous-loan":  "Several ProjectionLab loans are secured by this asset — pick one",
    "loan-not-found":  "No ProjectionLab loan is linked to this asset",
    "duplicate":       "Another link already targets this ProjectionLab account",
    "needs-monarch":   "Load Monarch to finish migrating this link",
  };
  const describeIssue = reason => ISSUE_TEXT[reason] ?? "Needs re-linking";

  return { vidOf, buildTargets, migrateMapping, describeIssue };
})();
