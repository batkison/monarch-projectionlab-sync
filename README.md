# Monarch → ProjectionLab Sync

A Chrome extension that syncs your account balances from **Monarch Money** into **ProjectionLab** with a single click.

---

## Features

- 🔐 **Secure** — credentials stored locally in Chrome storage, never sent anywhere except directly to Monarch/ProjectionLab
- 👁 **Preview before syncing** — see old vs new balances with change amounts before committing
- 🗺 **Flexible mapping** — map any Monarch account to any ProjectionLab account
- ⚡ **One-click sync** — once set up, syncing takes seconds
- 🕐 **Last-synced timestamp** — always know when data was last updated

---

## Installation (Chrome / Arc / Brave / Edge)

Since this is not on the Chrome Web Store, you install it as an **unpacked extension**:

1. Download and unzip this folder somewhere permanent (e.g. `~/Documents/monarch-pl-sync`)
2. Open Chrome and go to `chrome://extensions`
3. Toggle **Developer mode** on (top-right)
4. Click **Load unpacked**
5. Select the `monarch-pl-sync` folder
6. The extension icon appears in your toolbar — pin it for easy access

---

## Setup (one-time)

### Step 1 — Get your Monarch Money API token

1. Log into [Monarch Money](https://app.monarch.com)
2. Go to **Settings → Developer → API**
3. Copy your API token

> If you use Google to log in, you'll need to set a password first at **Settings → Security**.

### Step 2 — Get your ProjectionLab Plugin API key

1. Log into [ProjectionLab](https://app.projectionlab.com)
2. Go to **Account Settings → Plugins**
3. Toggle **Enable Plugins** on
4. Copy the **Plugin API Key**

### Step 3 — Save credentials in the extension

1. Click the extension icon → **Settings** tab
2. Paste your Monarch token and ProjectionLab API key
3. Click **Save**
4. Click **Test Connection** to verify both work

### Step 4 — Map your accounts

1. Open **app.projectionlab.com** in a browser tab (the extension needs this tab open to talk to ProjectionLab)
2. In the extension → **Account Mapping** tab
3. Click **Load Accounts** — this fetches all accounts from both services
4. For each account you want to sync, select the matching Monarch → ProjectionLab pair
5. Click **Save Mapping**

---

## Syncing

1. Make sure **app.projectionlab.com** is open in a tab
2. Click the extension icon
3. Click **Load Preview** to see what will change
4. Click **Sync Now** to push balances to ProjectionLab

---

## How it works

- **Monarch** is accessed via its unofficial but widely-used GraphQL API, using a Bearer token that you obtain from Monarch's developer settings
- **ProjectionLab** is accessed via its official [Plugin API](https://app.projectionlab.com/docs/module-PluginAPI.html) (`window.projectionlabPluginAPI`) — the extension injects a small bridge script into the PL tab to call this API on your behalf
- Your credentials are stored locally in Chrome's encrypted extension storage and are never transmitted to any third party

---

## Troubleshooting

**"No ProjectionLab tab found"**
Open `app.projectionlab.com` in a browser tab before syncing.

**"Plugin API not found"**
Make sure you've enabled Plugins in ProjectionLab's Account Settings.

**"Invalid Monarch token"**
Re-copy the token from Monarch's developer settings. Tokens can expire or be regenerated.

**Accounts not showing in mapping**
Click "Load Accounts" — this needs to fetch from both services fresh. Make sure the PL tab is open.
