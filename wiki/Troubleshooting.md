# Troubleshooting

## The CH | CP pill does not appear

- Confirm the site is enabled under **Settings → Sites**.
- Refresh the page after installing or updating the extension.
- Hover or point at the video or its card.
- For an unsupported site, enable **Any HTML5 video** if the page uses a standard video element.
- Some players hide their media or render through custom controls that the extension cannot detect.

## A video is not accepted by Coolhole

Check the on-page toast for the reason. Cool Pills may try Coolhost recovery when Coolhole rejects a media link as unplayable. Private, region-restricted, expired, login-gated, or short-lived source links may not be accessible to Coolhole or Coolhost.

If the room queue is full, Q+ can hold the item. A queue-limit error does not trigger media recovery.

Before Q+ sends a direct media-file URL, it makes a lightweight availability check. Confirmed unavailable links are removed from Q+ and sent to Coolhost to try recovery. If the check times out or the server does not provide a conclusive response, the item continues through the regular Coolhole queue flow.

## Reddit recovery fails

Make sure the Reddit tab is signed in and that the post can be played there. The signed-in page must expose a valid Reddit DASH manifest. Cool Pills does not send Reddit cookies to Coolhost. Reddit's separate video and audio tracks must be processed into a playable result; a video-only file is not a successful recovery for a regular video.

## Coolhost finished, but the video is missing from Q+

- Make sure Coolhole is open and signed in.
- Read the completion or error toast.
- Confirm that Coolhost returned a valid MP4 link and that it is still available.
- If Coolhost's own active upload card has a **CH** button, try sending that MP4 manually.

## Q+ does not auto-queue

- Sign in to Coolhole.
- Make sure Q+ is enabled and **Auto-queue when a slot opens** is selected.
- Keep a Coolhole tab open so the queue worker can run.
- Confirm that the room queue has a free slot and that the next item is still valid.

## Update check does not replace the extension

The update checker only locates and downloads a release; it does not replace extension files. Follow the manual browser-specific steps in [Installation and updates](Installation), then reload the extension and refresh pages.

## Collect useful details

When reporting a bug, include your browser and version, Cool Pills version, the affected site, the action you took, and the exact toast or error text. Do not share passwords, cookies, or private post data.
