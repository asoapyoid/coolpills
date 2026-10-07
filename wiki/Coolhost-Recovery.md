# Reddit and Coolhost recovery

## General Coolhost recovery

When Coolhole rejects a selected link as unplayable, Cool Pills may submit it to Coolhost (`coolhost.ca`) for processing. The extension waits for processing to finish and then sends the resulting MP4 to Coolhole. It does not queue the unfinished source as a substitute.

The Coolhost page opens or is reused in an inactive tab, so the recovery work does not take over your current page. When a Coolhole tab is open, Cool Pills can show start, processing, completion, or failure notices. Coolhost may require you to be signed in.

This recovery is for a playback rejection, not a full room queue. Coolhost uploads already hosted on Coolhost are not recursively sent back through recovery.

## Reddit flow

Reddit may require account authentication to expose its media. Cool Pills first tries public post metadata and a resolver that can return an audio-merged MP4. It rejects a `download.php` action as a playable link and avoids using a video-only stream for regular videos.

If the public path fails and Reddit exposes the media to your signed-in page:

1. The Reddit page requests its own post metadata using the page's signed-in session.
2. The extension checks that the returned DASH manifest belongs to Reddit's `v.redd.it` media host.
3. Coolhost receives the media manifest for processing, rather than Reddit login cookies or the Reddit post page.
4. When processing completes, Cool Pills queues the finished MP4 and includes the Reddit title and duration when available.

If the video duration is missing, the extension makes a best-effort attempt to read it from the finished MP4. The Q+ row displays `CH.CA` instead of a blank timer if a Coolhost MP4 still has no duration. If Reddit does not expose a valid manifest, Cool Pills reports the failure rather than queueing a broken Reddit post.

## Using Coolhost's CH button

On Coolhost, an active upload with a playable MP4 may have a **CH** button next to **Copy link**. Select it to send the uploaded MP4 to Coolhole. Expired history items are not given this button.

## Common failures

- **Authentication required:** sign in to Coolhost; Reddit's login is not forwarded to Coolhost.
- **Reddit manifest unavailable:** the signed-in Reddit page did not expose an accepted DASH manifest for that post.
- **Processing timed out or disconnected:** try again later; the upload's status connection may have been lost.
- **Upload completed but did not queue:** sign in to Coolhole and inspect the toast/error notice. Check whether the returned link is still active.

See [Privacy and permissions](Privacy-and-Permissions) for the cookie and URL handling details.
