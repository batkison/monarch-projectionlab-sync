# Privacy Policy — Monarch to ProjectionLab Sync

**Last updated:** March 14, 2026

## Overview

Monarch to ProjectionLab Sync ("the Extension") is a browser extension that syncs account balances from Monarch Money to ProjectionLab. This privacy policy explains how the Extension handles your data.

## Data Collection

**The Extension does not collect, store, or transmit any personal data to external servers.** All data processing happens locally in your browser.

## Data Access

The Extension accesses the following data solely to perform its core function of syncing account balances:

- **Monarch Money account data:** Account names, balances, types, and institution names are read from your logged-in Monarch Money session via browser tab injection. This data is used only to display in the Extension popup and to sync balances to ProjectionLab.
- **ProjectionLab account data:** Account names, balances, and types are read from your open ProjectionLab tab via the ProjectionLab Plugin API. This data is used only to display in the Extension popup and to match with Monarch accounts.
- **ProjectionLab Plugin API Key:** Stored locally in Chrome's synced storage (`chrome.storage.sync`) so you don't have to re-enter it. This key is only sent to ProjectionLab's own servers.
- **Account mapping configuration:** Your account link preferences (which Monarch account maps to which ProjectionLab account) are stored in `chrome.storage.sync` for convenience across devices.

## Data Storage

All Extension data is stored locally using Chrome's built-in `chrome.storage.sync` API. This data syncs across your Chrome browsers if you are signed into Chrome, but is never sent to any third-party server controlled by the Extension developer.

Stored data includes:
- ProjectionLab Plugin API Key
- Monarch session token (only if manually provided)
- Account mapping configuration
- Last sync timestamp

## Data Sharing

**The Extension does not share any data with third parties.** No analytics, tracking, or telemetry is collected.

## Permissions

The Extension requests the following browser permissions:

- **`storage`**: To save your settings and account mappings locally.
- **`scripting`**: To inject scripts into Monarch Money and ProjectionLab tabs to read account data.
- **`tabs`**: To detect open Monarch Money and ProjectionLab tabs.
- **`activeTab`**: To interact with the currently active tab when needed.
- **`cookies`**: To detect your logged-in Monarch Money session (used as a fallback authentication method).
- **Host permissions for `app.monarch.com` and `api.monarch.com`**: To communicate with Monarch Money's website and API.
- **Host permissions for `app.projectionlab.com`**: To communicate with ProjectionLab's website.

## Third-Party Services

The Extension interacts with:
- **Monarch Money** (https://monarch.com) — to read account balances
- **ProjectionLab** (https://projectionlab.com) — to update account balances

Please refer to the privacy policies of these services for information on how they handle your data.

## Changes to This Policy

If this privacy policy is updated, the changes will be posted here. Continued use of the Extension after changes constitutes acceptance of the updated policy.

## Contact

If you have questions about this privacy policy, you can reach out via the Extension's Chrome Web Store listing.
