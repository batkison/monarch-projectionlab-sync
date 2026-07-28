# Chrome Web Store listing — copy-paste kit

Everything below is ready to paste into the [CWS developer dashboard](https://chrome.google.com/webstore/devconsole).
The **name** and **short description** come from `manifest.json` (already updated in this repo) — they take effect when you upload the new version. The **detailed description**, screenshots, and promo images are set in the dashboard under *Store listing*.

---

## Name (from manifest.json)

```
Monarch Money → ProjectionLab Sync
```

Adding "Money" matters: people search the full brand name "Monarch Money", and the title is the strongest search signal in the store.

## Short description (from manifest.json, max 132 chars)

```
Sync Monarch Money account balances into ProjectionLab with one click. Preview every change first. No servers, no tracking.
```

## Category

Workflow & Planning (current) — keep.

## Detailed description (paste into dashboard)

```
Stop retyping balances. If you track your money in Monarch Money and plan your financial future in ProjectionLab, this extension keeps ProjectionLab's current balances up to date in one click.

HOW IT WORKS

1. Log in to Monarch Money in your browser — no API token needed, the extension uses your active session
2. Paste your ProjectionLab Plugin API key (official ProjectionLab Plugin API)
3. Link your accounts once — matching names are auto-linked for you
4. Click Sync. Done.

The popup shows a full preview before anything changes: current ProjectionLab balance, new Monarch balance, and the difference for every account. Untick anything you don't want to sync.

FEATURES

• One-click sync — updating every balance takes seconds
• Preview before syncing — see old vs. new balances with change amounts first
• Selective sync — checkboxes per account
• Auto-link by name — plus a full mapping editor with search, sort, and type filters
• Supports savings, investment accounts, assets, and debts (including real estate and auto loans)
• Cross-device settings — your mappings follow your Chrome profile
• Works with Chrome, Arc, Brave, and Edge

PRIVATE BY DESIGN

Your financial data never leaves your browser:

• No backend servers — the extension talks only to Monarch Money and ProjectionLab directly
• No analytics, tracking, or telemetry of any kind
• Your ProjectionLab API key is stored in Chrome's extension storage, nowhere else
• Your Monarch password is never seen or stored — the extension reads balances through the session you already have open
• 100% open source — audit the code on GitHub: https://github.com/batkison/monarch-projectionlab-sync

PERFECT FOR

FIRE planners, retirement planners, and anyone doing serious financial planning who uses Monarch Money for day-to-day tracking and ProjectionLab for long-term projections, Monte Carlo simulations, and net worth modeling.

GETTING STARTED

After installing, the popup walks you through the three setup steps with a live checklist. Setup takes about two minutes. You'll need a ProjectionLab account with Plugins enabled (Account Settings → Plugins) and a Monarch Money account.

Questions or issues? File them on GitHub or email the developer — links on this page.
```

## Dashboard checklist (manual steps)

- [ ] Store listing → replace **detailed description** with the text above
- [ ] Store listing → upload the new screenshots in this order:
      1. `screenshot-1-sync-1280x800.png` (preview table — the money shot)
      2. `screenshot-2-mapping-1280x800.png` (mapping editor)
      3. `screenshot-3-setup-1280x800.png` (onboarding checklist)
      4. `screenshot-4-settings-1280x800.png` (settings/connections)
- [ ] Store listing → upload `promo-small-440x280.png` (small promo tile) and `promo-marquee-1400x560.png` (marquee)
- [ ] Store listing → set **Homepage URL** to the GitHub repo (make the repo public first!)
- [ ] Privacy tab → make sure the **privacy policy URL** points at a hosted copy of `privacy-policy.md`
      (easiest: link to the file on GitHub once the repo is public)
- [ ] Upload the new ZIP (version bump included) so the manifest name/short-description change goes live

---

# Getting users — distribution playbook

The audience is the intersection of Monarch Money and ProjectionLab users. Store search alone won't reach them; go where they already are:

1. **ProjectionLab's community (biggest lever).** Join the official ProjectionLab Discord and post in the plugins/integrations channel. Ask Kyle (the founder — active and friendly to community tooling) about getting listed in ProjectionLab's docs as a community plugin. Every PL user who also uses Monarch is your entire market.
2. **r/MonarchMoney** — "I built a free, open-source extension that syncs your balances into ProjectionLab" with the preview screenshot. Genuine builder posts do well there.
3. **r/financialindependence / r/Fire** — ProjectionLab comes up constantly in tooling threads; comment with the extension when relevant (don't spam).
4. **Monarch's community forum** — same post as Reddit.
5. **Bogleheads forum** — software/tools threads.
6. **In-product flywheel** — the extension now asks happy users for a rating after their 3rd successful sync. Ratings are what make the listing convert once people find it.
