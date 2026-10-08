# Cool Pills

<p align="center">
  <img src="assets/cool-pills-brand.jpg" width="260" alt="Cool Pills CH to CP branding">
</p>

**Queue videos to [Coolhole](https://coolhole.org) from almost any site.** Cool Pills adds a small CH | CP pill to videos, a waiting list for full queues, and a history/settings panel.

| | |
|---|---|
| **Browser support** | Chrome, Edge, Brave and Firefox |
| **Current release** | [v3.1.7](https://github.com/asoapyoid/coolpills/releases/tag/v3.1.7) |
| **Queue controls** | CH to queue or remove; CP to go Fishing, add to Q+, or schedule |
| **Media recovery** | Coolhost processing for links Coolhole rejects |

See the [Cool Pills wiki](https://github.com/asoapyoid/coolpills/wiki) for the full installation guide, feature explanations, site coverage, privacy notes, and troubleshooting.

## Download

- [Download for Chrome, Edge or Brave](https://github.com/asoapyoid/coolpills/releases/latest/download/cool-pills-chrome-3.1.7.zip)
- [Download for Firefox](https://github.com/asoapyoid/coolpills/releases/latest/download/cool-pills-firefox-3.1.7.zip)
- [View all releases](https://github.com/asoapyoid/coolpills/releases)

## Install

### Chrome, Edge or Brave

1. Download the Chrome ZIP above and extract it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Open [Coolhole](https://coolhole.org) and log in.

### Firefox

1. Download the Firefox ZIP above.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select the downloaded ZIP.
4. Open [Coolhole](https://coolhole.org) and log in.

Firefox's temporary add-on is removed when Firefox closes; load it again after restarting.

## How it works

1. **Find a video.** On supported video sites and pages with HTML5 video, the extension detects videos and shows a CH | CP pill when you hover or point at one. The detector supports YouTube (including Shorts), Vimeo, Dailymotion, Twitch VOD pages, Bitchute, Rumble, Odysee, Streamable, Kick clips/VOD pages, Reddit posts with native media, and X posts with native video. You can also send links from pages that do not expose a player by using **CP** or the popup.
2. **Send it to Coolhole.** Click **CH** to queue the current video. Cool Pills passes the video link and available metadata (title, duration and thumbnail) to an open Coolhole tab. If there is no room in queue, the item can be sent to **Q+** if enabled.
3. **Handle a full queue.** Items that cannot be added yet can wait in **Q+**, the local waiting list. Reorder items by dragging, force or schedule an item, or paste multiple links with **+Link**.
4. **Choose what CP does.** Click **CP** to focus Coolhole and go Fishing by default. In settings, change CP to add to Q+, schedule, copy the video link, open Coolhole, do nothing, or run Custom (same-site open with copied link).
5. **Use history and themes.** The Coolhole panel includes searchable **Hist** with pins and one-click re-queue, plus the Q+ list. Choose Default, Old Steam or King Cobra, or match supported Coolhole room themes.

## Coolhost recovery

When Coolhole rejects a link as unplayable, Cool Pills uses an open Coolhost tab or opens one inactive tab if none is open, then submits the selected link for processing so you can continue using the room queue.

On Coolhost, each active upload with a playable MP4 link gets a **CH** button beside **Copy link**. Click it to send that upload to Coolhole. Expired history entries are not given a button.

## Check for updates

Open the extension's settings and choose **Check for updates**. Cool Pills checks the latest published GitHub release and offers the ZIP for your browser if a newer version is available. The extension does not auto-update because it is installed manually.

- **Chrome, Edge or Brave:** open the existing Cool Pills folder you selected with **Load unpacked**. Extract the new ZIP and copy its contents into that same folder, choosing **Replace the files in the destination**.
- **Firefox:** open `about:debugging#/runtime/this-firefox` and use **Reload** for Cool Pills if that control is available. If it is not, click **Remove**, then **Load Temporary Add-on** and select the new Firefox ZIP.

## Settings and saved data

Open the extension's settings page from your browser's extensions menu to:

- Enable or disable video detection per site.
- Change the theme, pill opacity, queue limit, auto-queue and CP action.
- Export or import settings and queue data as JSON.

Settings, pending items, history and pins are saved in the browser's local extension storage. Queue data is scoped to the Coolhole account detected in the current tab.

## Keyboard shortcuts

Use **Settings → Keyboard shortcuts** to turn shortcut actions on or off. Firefox also lets you record custom key combinations there. Chrome-based browsers do not let extensions change shortcut bindings directly; set those in the browser shortcut page.

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+Q` | Queue the current or hovered video |
| `Ctrl+Shift+W` | Focus Coolhole and go Fishing |
| `Ctrl+Shift+H` | Toggle the Hist / Q+ panel |

Browsers may reserve a shortcut. Remap it in the browser's extension shortcut settings.

## Troubleshooting

- **No CH | CP pill appears:** confirm the site is enabled in Cool Pills settings, refresh the page after installing/updating, and hover or point at the video.
- **Coolhole does not accept a link:** the extension will try Coolhost recovery for an actual media rejection. Some sites require a public, directly fetchable link; Coolhost may be unable to access private or geo-blocked media.
- **The upload finished but is not in Coolhole:** confirm you are logged in to Coolhole and check the toast for a queue error. You can also return to the active Coolhost upload and click its **CH** button manually.
- **Q+ does not advance:** keep a Coolhole tab open, sign in, enable Q+ auto-queue, and make sure the room has an available queue slot.

## Tampermonkey (YouTube-only)

If you only want the YouTube version, the old Tampermonkey userscript is still available here:  
https://greasyfork.org/en/scripts/591925-cool-pills-youtube-coolhole-queue-buttons

This script is only for YouTube + Coolhole queue buttons.

## Permissions and privacy

Cool Pills runs on pages where it looks for videos, so the browser asks to allow access to sites you visit. It uses browser storage for your settings and queue-related data, and communicates with Coolhole tabs to queue links.

Cool Pills prefers a direct MP4 for sites that Coolhole does not recognize. If the player only exposes another format, it keeps the page link rather than passing an unverified non-MP4 stream; native providers that Coolhole already supports are queued as their page links.

When queuing a social post without an exposed MP4, Cool Pills tries a site-specific public resolver: X uses VxTwitter then FxTwitter; Reddit checks post metadata and tries RapidSave for a direct, publicly fetchable MP4. If no usable direct link is found, it falls back to the post URL.

If Coolhole rejects a selected link as unplayable, Cool Pills automatically sends that link and its title to Coolhost (`coolhost.ca`) for processing. The browser uses your Coolhost session for this request.

## License

MIT. See [LICENSE](LICENSE).
