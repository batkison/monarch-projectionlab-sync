# Claude Instructions — Monarch → ProjectionLab Sync

The extension is published on the Chrome Web Store, so users run the store build. A local unpacked copy is only for testing.

## Version bumping

**Always increment the patch version in `manifest.json` before every `git commit` + push that changes extension code or anything shipped in the store zip.**

Commits that only touch docs or repo tooling (`CLAUDE.md`, `README.md`, `store-assets/`, `.gitignore`, and so on) don't get a bump. That keeps `main`'s version matching what's live in the store. They still go through a branch and a PR.

- Version field: `manifest.json` → `"version"`
- Use semantic patch increments: `1.3.1` → `1.3.2` → `1.3.3`, etc.
- Minor version (`1.3` → `1.4`) for new features or adapting to a breaking upstream API change; patch (`1.3.x`) for fixes and small changes.
- Include a "Bump version to X.Y.Z" note in the commit message (or a separate commit).

## Release workflow

Follow these steps in order. Steps that publish or push need the user's go-ahead.

1. **Branch:** never commit straight to `main`. Use a branch such as `fix/<topic>` or `feat/<topic>`.
2. **Commit** with the version bump, then push the branch and open a PR against `main` with `gh pr create`. The PR body covers the problem, the changes and the testing.
3. **Build the store zip** in the repo root as `monarch-pl-sync-X.Y.Z.zip`. Zips are gitignored. Include only the runtime files, with no dotfiles:
   ```sh
   zip -q -r monarch-pl-sync-X.Y.Z.zip manifest.json popup.html popup.js options.html options.js \
     icons/icon16.png icons/icon48.png icons/icon128.png \
     src/monarch-bridge.js src/pl-bridge.js src/background.js src/monarch-page.js src/pl-page.js src/pl-accounts.js -x '.*'
   ```
   If a file is added under `src/` or referenced from the manifest or HTML, add it to this list. Check the result with `unzip -l` and confirm that the zip's `manifest.json` version is correct.
4. **The user tests the unpacked build**, then uploads the zip in the Chrome Web Store Developer Dashboard. Claude can't publish to the store.
5. **After the user confirms the store publish:**
   - Merge the PR with a merge commit: `gh pr merge <n> --merge --delete-branch`
   - Switch to `main`, pull with `git pull --ff-only`, and run `git fetch --prune`
   - Tag the merge commit and push the tag: `git tag -a vX.Y.Z -m "..." <merge-sha> && git push origin vX.Y.Z`
   - Create the GitHub release: `gh release create vX.Y.Z monarch-pl-sync-X.Y.Z.zip --title "vX.Y.Z — <summary>" --notes "..."`. Write the notes for users (what changed and what they need to do) and link the PR.

   Keep `main` matching what's live in the store. Don't merge before the store publish, and don't leave a published version unmerged.

## Testing an unpacked build alongside the store install

- An unpacked copy gets a **different extension ID** from the store version, because `manifest.json` has no `key`. `chrome.storage.sync` is separate for each ID, so the unpacked copy starts with no mappings and no API key. The store install's data is never touched.
- To load it: open `chrome://extensions`, turn on Developer mode, **turn off the store version** (don't remove it), then click Load unpacked and pick this folder.
- To copy real settings over, which also tests link migration: open the store version's Options page → Inspect → Console and run `chrome.storage.sync.get(null, d => copy(JSON.stringify(d)))`. Then, in the unpacked copy's Options console, run `chrome.storage.sync.set(JSON.parse('<paste>'), () => location.reload())`.
- After an extension update, refresh any open ProjectionLab and Monarch tabs.

## ProjectionLab Plugin API

- **Docs:** https://app.projectionlab.com/docs/ (the index includes the V4→V5 migration guide) and https://app.projectionlab.com/docs/types/PluginAPI.html. Help articles live under https://cdn.projectionlab.com/help/ (`use-the-plugin-api`, `projectionlab-v5-early-access-guide`). If ProjectionLab changes and things break, check these first.
- **Version detection:** read `api.version ?? 1` on every call and never cache it. V4 (legacy) has no `version` property; V5 has `version === 2`. Reject unsupported versions with a clear error, and never retry a failed V5 write through the V4 path.
  - **V4:** discovery uses `exportData().today.{savingsAccounts, investmentAccounts, assets, debts}`; writes use `updateAccount(id, { [field]: n }, { key })`. An asset has `amount` (its value) and `balance` (its attached loan).
  - **V5:** discovery uses `getAccounts({ key })`, which returns records with `kind` set to `account`, `debt` or `real-asset`. Writes use `updateAccountValues({ accountId, values: { balance | value }, key })`. A loan is its own debt account, linked by `securedByAssetId`. A positive debt balance means money owed.
- **Code layout:**
  - `src/pl-page.js` runs in the page (MAIN world) and is the only code that calls `window.projectionlabPluginAPI`, through the `getAccounts` and `updateValue` actions.
  - `src/pl-accounts.js` is shared by the popup and options pages. It turns both API versions into the same sync targets `{ vid, plId, plField, ... }` and migrates saved links (`migrateMapping`).
  - Saved mappings are `{ monarchId, plId, plField }` in `chrome.storage.sync.accountMapping`.
- **Message tags:** messages between page and bridge are tagged with a version (`monarch_pl_sync_ext_v2` / `monarch_pl_sync_page_v2`), and the registration guards are `__plPageRegisteredV2` / `__plBridgeRegisteredV2`. If the message protocol changes, bump these tags. Otherwise, scripts injected by an older version into an already-open tab will answer requests meant for the new one.
- **Migrations must never drop links.** A link that can't be resolved unambiguously is kept and reported as an issue. The user sees it in the popup warning and in Manage Links.

## Testing changes

- Run `node --check` on every changed JS file.
- For ProjectionLab-facing logic, write a Node harness that loads `src/pl-accounts.js` and `src/pl-page.js` into a `vm` context. Run it against mocked V4 and V5 `projectionlabPluginAPI` objects, and cover discovery, migration edge cases and writes. Compare results across the VM boundary with JSON (`deepStrictEqual` fails on objects from another context).
- Then the user verifies the unpacked build against their live account: preview, Manage Links, one sync, and a check in Net Worth that it saved.
