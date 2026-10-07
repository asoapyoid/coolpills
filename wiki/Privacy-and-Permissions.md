# Privacy and permissions

Cool Pills runs on websites so it can detect video players and place controls next to them. The browser therefore asks for permission to access pages where the extension runs. It uses extension storage for settings, Q+, history, pins, and related state.

## Data sent when you use the extension

- **Coolhole:** when you queue or schedule an item, Cool Pills sends the selected media URL and available title, duration, and thumbnail to Coolhole.
- **Metadata lookup:** the extension may request public page metadata so a queued item can show a useful title, duration, or thumbnail.
- **Social resolvers:** when a resolver is used, it receives the public social post URL to locate a playable media link. This may include VxTwitter/FxTwitter, RapidSave, TikWM/MusicalDown, FBDown, or the ddinstagram mirror.
- **Coolhost:** for an eligible rejected link, Coolhost receives the submitted source URL for processing. The browser may use your Coolhost login session. Cool Pills does not forward login cookies from the original video site.

For Reddit's gated-media path, the signed-in Reddit page reads its own post metadata and returns an accepted `v.redd.it` DASH manifest to the extension. Coolhost receives that manifest, not the Reddit post page or Reddit login cookies.

## Local data

Settings and Q+/history data are saved in browser extension storage. Queue data is scoped to the Coolhole account detected by the extension. Use the settings page to export or import a JSON backup.

## Permissions at a glance

- **Storage:** save settings and queue-related data.
- **Active tab and tabs:** communicate with open Coolhole/Coolhost pages and open a tab when needed.
- **Scripting:** support extension actions on matching tabs.
- **Site access:** detect media and read page metadata on supported websites.

The extension does not need your source-site password. Do not send exported backups publicly if they contain private links or queue history.
