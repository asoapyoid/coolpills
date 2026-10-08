# Coolpills project guide

## Overview

Coolpills is a browser-extension project for video workflows around YouTube and [Coolhole](https://coolhole.org). Its product goals include queuing YouTube videos to Coolhole, earning CP through Work, managing videos that cannot yet be queued, and providing queue history and a small floating Coolhole interface.

This guide captures product and handoff notes for the Manifest V3 extension (Chrome, Edge, Brave and Firefox) in this repository. The notes originate from an earlier userscript, so the sections below describe **intended behavior**; confirm specifics against the source files listed in the repository map before changing code.

## Product behavior

| Surface | Intended behavior |
| --- | --- |
| YouTube | Show a CH / CP pill around video cards and the watch-page menu area. CH queues the current video, or adds it to Q+ when the room queue is full. CP focuses Coolhole and starts Work. Long-press or a menu opens settings. |
| Coolhole | Show a floating Hist / Q+ control. Hist holds previously queued videos; Q+ holds videos waiting for room capacity. |
| Shared workflow | Support Work/CP, pending auto-queue, per-account history and pins, search, themes, and status toasts. |

The YouTube pill is intended to fade and scale in and out. Optional gray or colored button styling, a rare gold hover, and a light-theme treatment are part of the product notes. On Coolhole, the floating control can be dragged, collapsed to a chip, and adjusted with an opacity slider. In Cinema and Match views it should fade completely when idle, after roughly three seconds, like other Cinema chrome.

### Hist and Q+

- **Hist** lists previously queued videos for the current Coolhole account. Entries can be pinned and searched; selecting a title opens that video on YouTube, and CH can queue it again.
- **Q+** holds pending entries when the room queue is over its limit. It auto-queues an entry when a slot opens and supports drag reordering, with the top entry next.
- The intended queue-limit behavior adapts to limits inferred from errors and observed queue state.
- Toasts distinguish queue, Q+, error, gold, and final-Q+ messages using role colors.

### Duration and history

The intended compact row layout is:

`Title | 3:45 [Force] [×]`

Use the duration scraped from YouTube when creating the queue payload, then carry its numeric value and display label into Hist and Q+. Older saved entries may not have duration until they are queued again. Do not append duration to the title text if the row also renders a separate duration element.

### Search

Hist search should use a real, compact text input that expands on focus and filters history. The intended interaction is inline search, not a separate Find button or an emoji-only search icon; icons can be invisible with some Coolhole fonts. If changing the panel rendering, preserve input focus while filtering.

## Extension architecture and integration guidance

The source notes describe a userscript predecessor; this repository implements the same ideas as a Manifest V3 extension:

- `manifest.json` registers content scripts for non-Coolhole pages (`storage.js`, `adapters.js`, `ui.js`, `detector.js`), for Coolhole (`storage.js`, `ui.js`, `coolhole.js`, plus `bridge-main.js` in the MAIN world), for Coolhost (`coolhost.js`) and for Reddit (`reddit-main.js`), and a service worker (`background.js`).
- The Coolhole content script owns Hist/Q+, queueing, auto-queue and queue-limit learning. The background worker relays messages between tabs, arbitrates the auto-queue lock, and performs fetches such as metadata, media-link checks and Coolhost recovery.
- Use the extension's own storage layer (`storage.js`) and messaging rather than userscript `GM_*` APIs.
- Selectors named in the predecessor notes (`#queue`, `.q-user`, the media URL input, queue-end button, and Options theme select) are leads; the Coolhole script selects `#queue-url` / `#btn-queue` on the new site and `#mediaurl` / `#queue_end` on the classic one. Re-verify them when Coolhole changes.
- YouTube's duration badges may live in nested or shadow DOM. Any scraper should be resilient to markup changes and tested against current YouTube pages.

### Queue-limit and Coolhost recovery rules

- A full queue is not a broken link. A queue-limit message, or no row being added while the user is at the room limit, keeps the item in Q+; it must never trigger Coolhost recovery.
- Coolhole error text is read from server messages only. Other users' chat lines are ignored, and repeated identical error lines still count as new.
- Only clearly broken-media errors, or a confirmed expired direct link, send a link to Coolhost.

### State and account scoping

The product requires Q+, Hist, and pins to follow the logged-in Coolhole username and switch when the account changes. The predecessor represented scoped data with names such as:

| Data | Conceptual contents |
| --- | --- |
| `cq_pending_<account>` | Q+ entries: video ID, title, duration, duration label, and added time |
| `cq_history_<account>` | Hist entries: video ID, title, duration, duration label, and queued time |
| `cq_pins_<account>` | Pinned history entries |
| Shared preferences | Theme choice, site-theme matching, float opacity, gray buttons, CP mode, auto-queue, Q+ enabled state, collapsed state, and related settings |
| Shared coordination | Queue/work requests and the last detected Coolhole theme |

These names describe the earlier integration and are not a requirement to use the same key format or storage API in the extension. Preserve account isolation and cross-tab behavior using the extension's actual storage and messaging mechanisms. Handle login changes explicitly so one account's lists are not shown as another account's.

## Theme model

The key UX distinction is whether the user wants Coolhole's actual theme or a Coolpills-owned appearance:

| Setting | Intended behavior |
| --- | --- |
| Match Coolhole theme on | Detect the site's theme and let site CSS style the Coolpills float. Known predecessor theme IDs were `coolhole`, `cinema`, `v2`, and `wc2`; unknown IDs fall back to the Coolpills default. |
| Match off, Default selected | Apply the isolated Coolpills default so Coolhole textures and colors do not bleed into it. |
| Match off, Steam selected | Apply the independent Old Steam appearance. |

The manual dropdown is intended to contain **Default (CQ)** and **Old Steam**. Site-specific theme packs belong to Match mode, not the manual dropdown.

When matching, do not paint Coolpills colors over Coolhole's UI. Let the site theme style the float and keep only the necessary structure and controls integrated with the site's styling. When Match is off, isolate the float so site styles do not make Default look like WC2. Avoid blanket `!important` theme paints; use narrowly scoped structural rules only where necessary.

### Theme pitfalls from prior iteration

- Clearing Coolpills styles in Default can leave the float owned by site CSS; Default needs isolation when Match is off.
- Forcing the Coolpills theme over Match mode can flatten or discolor the site's intended look. Match should not force theme paints.
- Transparent backgrounds and forced white text can erase site textures or text contrast.
- Highly specific pill/segment selectors can defeat site button styles. Scope Coolpills-only colors so they do not apply in Match mode.
- Manual Default and Steam must remain independent of Coolhole's Options theme.
- Verify WC2 textures, Cinema idle hiding, and Default isolation when changing theme behavior.

The predecessor used a `cq-match-site` class on `#cq-float` and Bootstrap-like classes as an integration technique. These are historical implementation examples only; confirm the extension's current DOM and styling approach before reusing them.

## Repository map

| Path | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest: permissions, content scripts, service worker |
| `background.js` | Service worker: messaging, auto-queue lock, metadata and link checks |
| `coolhole.js` | Coolhole-side Hist/Q+, queueing, auto-queue, limit learning |
| `coolhost.js`, `reddit-main.js`, `bridge-main.js` | Coolhost recovery, Reddit media lookup, MAIN-world bridge |
| `storage.js`, `adapters.js`, `detector.js`, `ui.js` | Shared storage and settings, site adapters, pill detection, shared UI |
| `options.html`, `options.js`, `options.css` | Settings page |
| `wiki/` | User-facing documentation |
| `CHANGELOG.md`, `scripts/package.py`, `package.sh` | Release notes and packaging |
| `artifacts/PROJECT.md` | This product and handoff guide |

The predecessor userscript file (`artifacts/YouTube-Coolhole-Queue-Buttons.user.js`) is not part of this repository.

## Editing and verification conventions

- Keep changes focused on the extension implementation and its actual conventions. Do not introduce or update userscript metadata for an extension change.
- For user-visible changes, update the version field used by the real extension packaging/release process, once identified; the version in the predecessor notes is historical context, not authoritative metadata.
- Prefer letting Coolhole style its own interface in Match mode over sampling colors or forcing a copied palette.
- Keep manual themes independent from the site's theme setting.
- Preserve per-account Q+, Hist, and pin scoping, including login changes.
- When changing themes, visually verify Match (especially WC2 and Cinema) and Default isolation on the live site where possible.
- Test extension code with the repository's actual lint, build, and test commands. A userscript-only parse check is not a substitute for extension validation.
- YouTube markup changes over time; verify duration extraction and pill placement against current card and watch-page layouts.

## Backlog and deferred ideas

### Likely next improvements

- Backfill duration for older Hist/Q+ entries, either with a one-shot scrape or when the panel opens.
- Filter history without fully rerendering the panel or losing search focus.
- Polish toast appearance under Match and Cinema themes.
- Prepare release notes when a build is explicitly frozen for release.

### Discussed or deferred

- Make CP clicks use a configurable inventory item.
- Add a CP charge-up animation while Work is on cooldown.
- Detect other users of the extension.
- Add theme presets beyond Default and Steam; site packs remain Match-only.
- Consider guest-account support only if it works reliably, as a low-priority feature.
- Explore a lightweight presence or “also on CQ” marker for Coolhole users with the extension.

### Hardening

- Make YouTube duration selectors more resilient to DOM changes.
- Exercise queue-limit learning with shared accounts and role changes.
- Reduce remaining YouTube pill hover/scroll flicker, including interference from third-party YouTube extensions.

## Handoff checklist

1. Read this guide, then inspect the actual extension manifest and source tree; this document is product context, not a substitute for source.
2. Find the implementation of Match/theme resolution, account-scoped storage, YouTube duration scraping, and the Coolhole queue controls before editing.
3. Preserve the central theme rule: Match uses the real site look; Default and Steam are Coolpills-owned and isolated.
4. Do not reintroduce live color sampling or force Coolpills theme packs onto the matched Coolhole UI.
5. Confirm current selectors, storage APIs, and file paths rather than copying userscript-era assumptions.
6. Ask before large UX changes. Theme work is especially sensitive and should be checked visually on live Coolhole, particularly WC2 and Cinema.
