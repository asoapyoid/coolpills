# Cool Pills

**Queue videos to [Coolhole](https://coolhole.org) from almost any site.** Cool Pills adds a small CH | CP pill to videos, a waiting list for full queues, and a history/settings panel.

## Download

- [Download for Chrome, Edge or Brave](https://github.com/asoapyoid/coolpills/releases/latest/download/cool-pills-chrome-3.0.1.zip)
- [Download for Firefox](https://github.com/asoapyoid/coolpills/releases/latest/download/cool-pills-firefox-3.0.1.zip)
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

1. **Find a video.** On supported video sites and pages with HTML5 video, the extension detects videos and shows a CH | CP pill when you hover or point at one. The detector supports YouTube, Vimeo, Twitch, TikTok, Instagram, X/Twitter, Reddit, Dailymotion, Kick and generic HTML5 videos.
2. **Send it to Coolhole.** Click **CH** to queue the current video. Cool Pills passes the video link and available metadata (title, duration and thumbnail) to an open Coolhole tab. If there is no Coolhole tab, it opens one with the queue request. If the video is already queued, the control becomes **UN** so you can remove it.
3. **Handle a full queue.** Items that cannot be added yet can wait in **Q+**, the local waiting list. Reorder items by dragging, force or schedule an item, or paste multiple links with **+Link**. With auto-queue enabled, Coolhole adds the next waiting item when a slot opens. A lock prevents multiple Coolhole tabs from sending the same item at once.
4. **Choose what CP does.** Click **CP** to focus Coolhole and run Work by default. In settings, change CP to add to Q+ or schedule instead. Hold the pill for quick settings.
5. **Use history and themes.** The Coolhole panel includes searchable **Hist** with pins and one-click re-queue, plus the Q+ list. Choose Default, Old Steam or King Cobra, or match supported Coolhole themes. **Gold Collector** assists with lottery chat lines.

## Check for updates

Open the extension's settings and choose **Check for updates**. Cool Pills checks the latest published GitHub release and offers the ZIP for your browser if a newer version is available. Downloading a browser extension from GitHub cannot silently replace an installed extension, so finish the update manually:

- **Chrome, Edge or Brave:** extract the new ZIP over the existing unpacked extension folder, then open `chrome://extensions` and click **Reload** on Cool Pills.
- **Firefox:** load the new ZIP again from `about:debugging#/runtime/this-firefox`. Temporary add-ons must be loaded again after Firefox restarts.

## Settings and saved data

Open the extension's settings page from your browser's extensions menu to:

- Enable or disable video detection per site.
- Change the theme, pill opacity, queue limit, auto-queue and CP action.
- Export or import settings and queue data as JSON.

Settings, pending items, history and pins are saved in the browser's local extension storage. Queue data is scoped to the Coolhole account detected in the current tab.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+Q` | Queue the current or hovered video |
| `Ctrl+Shift+W` | Focus Coolhole and run Work |
| `Ctrl+Shift+H` | Toggle the Hist / Q+ panel |

Browsers may reserve a shortcut. Remap it in the browser's extension shortcut settings.

## Permissions and privacy

Cool Pills runs on pages where it looks for videos, so the browser asks to allow access to sites you visit. It uses browser storage for your settings and queue-related data, and communicates with Coolhole to carry out queue and Work actions. When you choose to queue or schedule, the selected video link and its available metadata are sent to Coolhole. The extension may fetch public page metadata such as a title, duration or thumbnail so queued items are recognizable.

TikTok, Instagram, X/Twitter, Reddit and Kick links may not play on Coolhole.

## License

MIT. See [LICENSE](LICENSE).
