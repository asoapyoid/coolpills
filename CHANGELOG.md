# Changelog

## 3.1.6
- Make the Queue option 'If no Coolhole tab is open, create one' work; when off, show a toast asking you to open a Coolhole tab instead of opening one.
- Avoid opening another Coolhost tab when an existing tab is unresponsive; retry the most recently used tab and report an actionable error if it still does not respond.
- On YouTube Shorts watch pages, show the pill when hovering the Share control, including when YouTube renders it inside a shadow root.

## 3.1.5
- Avoid opening a second Coolhole tab when an existing tab is slow or unresponsive; try other open Coolhole tabs and show an actionable error if none respond.
- Recognize `www.coolhole.org` as an existing Coolhole tab.
- Improve YouTube Shorts detection when YouTube's active Shorts player exposes the video ID in its renderer instead of the URL.

## 3.1.4
- Check direct media links from Q+ just before queueing; try Coolhost recovery and remove links that are confirmed expired.

## 3.1.3
- Detect X's visible `GIF` badge within the media area and suppress the pill for those posts.

## 3.1.2
- Do not show video pills on X/Twitter GIF media.

## 3.1.1
- Show `CH.CA` in Q+ when a Coolhost MP4 has no available duration.
- Clean up Coolhost URL detection placement in the Q+ list helpers.

## 3.0.29
- Preserve Reddit post titles and duration from its media metadata through Coolhost processing into Coolhole Q+.
- Probe the finished Coolhost MP4 for duration when Reddit does not provide one.

## 3.0.28
- Run Reddit Coolhost recovery in an inactive background tab so it does not interrupt the current page.
- Send Coolhost start, progress, and completion notices to the open Coolhole tab.

## 3.0.27
- Allow Reddit DASH recovery when the video is selected from a subreddit feed, while still validating the Reddit post and media host.

## 3.0.26
- For Reddit posts that require login, read the DASH playlist in the signed-in Reddit page and give the direct media manifest to Coolhost instead of asking it to fetch the gated post page.
- Never send Reddit login cookies to Coolhost; stop with a clear error if Reddit does not expose a media playlist.

## 3.0.25
- Open Coolhost visibly for Reddit fallback uploads and show whether processing was accepted, completed, or failed.

## 3.0.24
- Stop queueing Reddit post pages when direct MP4 lookup fails; send the post to Coolhost and queue only the processed MP4.
- Resolve Reddit posts even when the page exposes a video-only MP4, so RapidSave can provide an audio-merged file.
- Allow Coolhost recovery requests only from Coolhole or a verified Reddit post page.

## 3.0.23
- Prefer MP4 links for unrecognized sites and accept non-MP4 links only for CyTube-native providers, raw media files and HLS playlists.
- Use CyTube-native Twitch clip links instead of resolving them through Clipr.

## 3.0.22
- Do not queue RedditSave's `download.php` download endpoint as if it were playable media; only accept a direct MP4, otherwise continue through the original Reddit link and Coolhost recovery.

## 3.0.21
- Add a black outline and subtle shadow to text in gold and gold Q+ toasts for better contrast.

## 3.0.20
- Resolve TikTok videos through TikWM and MusicalDown, Facebook videos through FBDown, and Instagram posts through the ddinstagram mirror; failed lookups continue with the original post so Coolhost recovery can still run.
- Resolve Twitch clips through Clipr and queue its verified Twitch CDN MP4; ordinary Twitch streams continue to use their existing flow.

## 3.0.19
- Resolve Reddit videos through RapidSave's merged download link so split audio/video streams retain sound.
- Do not silently queue a Reddit video-only DASH stream when an audio-merged link cannot be found.

## 3.0.18
- Automatically send links Coolhole rejects to Coolhost for processing, then queue the completed MP4; show toast warnings when Coolhost cannot process or deliver it.
- Add a CH button beside active Coolhost upload links to send them to Coolhole; expired uploads do not get a button.

## 3.0.17
- Resolve Reddit posts to direct v.redd.it MP4 links using Reddit post metadata, with RedditSave as a fallback.

## 3.0.16
- Detect smaller social-feed videos and video-post thumbnails when sites use custom post cards instead of standard video elements.
- Add Facebook and Threads adapters and recognize Instagram mirror domains.

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
