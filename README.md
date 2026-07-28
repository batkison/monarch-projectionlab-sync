# Monarch Money → ProjectionLab Sync

A Chrome extension that syncs your account balances from **[Monarch Money](https://www.monarchmoney.com/)** into **[ProjectionLab](https://projectionlab.com/)** with one click — no more retyping balances by hand every month.

**[➡ Install from the Chrome Web Store](https://chromewebstore.google.com/detail/mbmlgebglmgfiifpjmemfhhmpgamfcba)**

---

## Why

If you track spending in Monarch and plan your financial future in ProjectionLab, keeping ProjectionLab's current balances up to date is a manual chore. This extension automates it:

1. Reads current balances from your Monarch session
2. Shows you exactly what will change (old → new, with diffs)
3. Pushes the balances you approve into ProjectionLab via its official Plugin API

## Features

- ⚡ **One-click sync** — once set up, updating every balance takes seconds
- 🏠 **Dual-field assets** — a ProjectionLab asset with an attached loan (house + mortgage, car + auto loan) maps as two separate fields, so Monarch's home value and mortgage balance sync independently and your equity stays correct
- 👁 **Preview before syncing** — see old vs. new balances with change amounts before committing anything
- ☑️ **Selective sync** — checkboxes per account; sync only what you want
- 🔗 **Auto-link by name** — accounts with matching names are linked automatically; a full mapping editor handles the rest (search, sort, filter by type)
- 🔄 **Cross-device settings** — mappings and settings sync via your Chrome profile
- 🔐 **Private by design** — no servers, no analytics, no data collection; the extension talks only to Monarch and ProjectionLab directly (see [Privacy](#privacy--security))

## Setup (one-time, ~2 minutes)

### 1. Log in to Monarch Money

Open [app.monarch.com](https://app.monarch.com) in this browser and log in. That's it — the extension reads balances through your active session. No API token needed.

### 2. Get your ProjectionLab Plugin API key

1. Log into [ProjectionLab](https://app.projectionlab.com)
2. Go to **Account Settings → Plugins**
3. Toggle **Enable Plugins** on and copy the **Plugin API Key**
4. Paste it in the extension's **Settings** tab and click **Save**

### 3. Map your accounts

1. In the extension, open **Account Mapping**
2. Click **Load Both**, then **Auto-Link by Name** (or link accounts manually)
3. Adjust any remaining pairs and save

The popup's Sync tab shows a live checklist of these steps until setup is complete.

## Syncing

1. Keep **app.projectionlab.com** open in a tab (the extension talks to ProjectionLab through its Plugin API on that page)
2. Click the extension icon — the balance preview loads automatically
3. Review the changes, untick anything you don't want, and click **Sync Selected**

## How it works

- **Monarch** balances are read via Monarch's GraphQL API using your existing browser session — the extension never sees or stores your Monarch password
- **ProjectionLab** is updated via its official [Plugin API](https://app.projectionlab.com/docs/module-PluginAPI.html) (`window.projectionlabPluginAPI`); the extension injects a small bridge script into your ProjectionLab tab to call it
- Everything runs locally in your browser — there is no backend

## Privacy & security

- Your ProjectionLab API key and account mappings are stored in Chrome extension storage (synced across your own Chrome profile), nowhere else
- No data is ever sent to any third party — the only network traffic is between your browser and Monarch/ProjectionLab themselves
- No analytics, tracking, or telemetry of any kind
- The entire source code is in this repository — audit it yourself

See the full [privacy policy](store-assets/privacy-policy.md).

## Installing from source (developer mode)

1. Clone or download this repository
2. Open `chrome://extensions` and toggle **Developer mode** on
3. Click **Load unpacked** and select the repository folder

Works in Chrome, Arc, Brave, Edge, and other Chromium browsers.

## Troubleshooting

**"No Monarch tab found" / Monarch not connected**
Open `app.monarch.com` in a tab and log in, then click Test Connection. If it still fails, refresh the Monarch tab.

**"No ProjectionLab tab found"**
Open `app.projectionlab.com` in a tab before syncing — the popup offers an *Open ProjectionLab* button when this happens.

**"Plugin API not found" / ProjectionLab did not respond**
Make sure **Enable Plugins** is turned on in ProjectionLab's Account Settings, then refresh the ProjectionLab tab.

**Accounts not showing in the mapping editor**
Click **Load Both** to fetch fresh account lists from both services. Both tabs (Monarch and ProjectionLab) need to be open.

## Support

If this extension saves you time, consider [buying me a coffee](https://account.venmo.com/u/Brent-Atkison) ☕ — and a [rating on the Chrome Web Store](https://chromewebstore.google.com/detail/mbmlgebglmgfiifpjmemfhhmpgamfcba/reviews) helps other Monarch + ProjectionLab users find it.

## License

[MIT](LICENSE)
