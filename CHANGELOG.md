# Changelog

## 3.0.15
- Remove the unsupported-media asterisk from the CH button; queue failures are reported by toast.
- Label videos without a discoverable title as "Raw Video".

## 3.0.14
- Fall back to FxTwitter when VxTwitter cannot resolve an X/Twitter video.

## 3.0.13
- Report Coolhole queue rejections with a useful toast and remove failed items from Q+ instead of retrying them indefinitely.

## 3.0.12
- Prefer direct video-file URLs on sites where Coolhole cannot consume the page link, and resolve X post videos to MP4 through VxTwitter when queued.

## 3.0.11
- Keep the pill anchored to one stable thumbnail corner per YouTube video card to prevent it jumping between card controls.

## 3.0.10
- Prevent duplicate extension copies from rendering overlapping pills; the newest Cool Pills pill takes priority.

## 3.0.9
- Restore the full CH | CP pill on YouTube video cards.

## 3.0.8
- Add an options-page switch to disable/enable keyboard shortcut actions and in-options remapping where supported by the browser.

## 3.0.7
- Detect Coolhole's active theme from its `data-theme` attribute so Black Spring is recognized reliably.

## 3.0.6
- Improve Black Spring day/night/bloodmoon detection and keep the cycle synchronized when Coolhole updates or inserts its phase indicator.

## 3.0.5
- Match the Coolhole floating pill and panel to the supplied userscript’s theme-specific shells, borders, active states, and shadows.

## 3.0.4
- Align pill and Coolhole theme styling with the supplied YouTube userscript, including phase colors, gray mode, progress fills, and theme-specific typography.

## 3.0.3
- Show only the queue button on YouTube video cards; keep the full CH | CP pill on watch pages and other sites.

## 3.0.2
- Improve dropdown text and background contrast in light and dark settings themes.

## 3.0.1
- Add a settings-page button to check the latest GitHub release and download the matching browser ZIP.
- Fix extension icon paths so the unpacked project and release ZIPs load the icons correctly.
- Add a repeatable package script and GitHub Actions release workflow.

## 3.0.0
- Rewritten from the Tampermonkey userscript (v2.8.4.19) as a Manifest V3 extension for Chrome and Firefox.
- Works on YouTube, Vimeo, Twitch, TikTok, Instagram, X/Twitter, Reddit, Dailymotion, Kick and any HTML5 `<video>`.
- Per-site on/off toggles, JSON export/import, keyboard shortcuts, light/dark settings page.
- Themes: Default, Old Steam, King Cobra, plus Match Coolhole (Coolhole default, Cinema, Black Spring day/night, Battle.net).
- Auto-queue is lock-arbitrated so several Coolhole tabs never double-queue.
