# Store asset capture harness

Renders the real extension UI with mocked `chrome.*` APIs so store screenshots can be
regenerated in any browser — no extension loading required.

## Contents

- `chrome-stub.js` — mock `chrome.storage` / `chrome.runtime` / `chrome.tabs` with sample account data
- `popup.js` — **copy** of the real `../../popup.js` (refresh it after popup changes: `cp ../../popup.js .`)
- `index.html` / `fresh.html` / `partial.html` / `nopl.html` / `settings.html` — the popup in different states
  (ready with preview loaded, empty onboarding, partially set up, "no PL tab" error, Settings tab)
- `shots/` — 1280×800 composition pages (`shot1`–`shot4`) plus `promo-small.html` (440×280) and
  `promo-marquee.html` (1400×560); `shots/options.js` is likewise a copy of the real options page script,
  and `shots/options-preview.html` drives the mapping editor with auto-loaded data

## Regenerating the assets

1. Refresh the script copies if the real UI changed:
   `cp ../../popup.js . && cp ../../options.js shots/options.js`
2. From the repo root: `python3 -m http.server 8123`
3. Open `http://127.0.0.1:8123/store-assets/capture/shots/shot1.html` (…shot2–4, promo-small, promo-marquee)
4. Screenshot each page at exactly its target size (viewport 1280×800 for shots, 440×280 / 1400×560 for promos)
   and save over the PNGs in `store-assets/`

The harness pages must be served over HTTP (not `file://`) so the iframes are same-origin.
