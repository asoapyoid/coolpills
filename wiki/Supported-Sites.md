# Supported sites and media

Cool Pills detects players on supported websites and can optionally detect generic HTML5 `<video>` elements on other sites. Detection or playback support does not guarantee that every post is accessible: sites may require sign-in, restrict regions, expire media links, or change their page structure.

## Site adapters

The extension has site-specific detection for:

- YouTube
- Vimeo
- Twitch, including clips
- TikTok
- Instagram and recognized mirror domains
- X / Twitter
- Reddit
- Dailymotion
- Kick
- Facebook
- Threads
- Generic HTML5 video, when enabled

Per-site controls and the generic detector switch are available under **Settings → Sites**.
X/Twitter GIF media is excluded from pill detection. The extension also checks for X's visible `GIF` badge over the media, because GIF posts can use the same video player elements as regular videos.

## Native players and direct media

Coolhole can handle some provider links natively. For sites it does not recognize, Cool Pills prefers a direct MP4 and avoids treating a download-action page as playable media. Direct raw-media URLs and HLS playlists are handled as exceptions where supported by the current site flow.

Supported native provider links include YouTube, Vimeo, Dailymotion, Google Drive, SoundCloud, Livestream, Twitch, Streamable, PeerTube, Bandcamp tracks, BitChute, Odysee, and NicoNico. Actual availability depends on the Coolhole player and the provider's current restrictions.

## Social video resolvers

When a social post does not expose a usable MP4, Cool Pills may try a site-specific public resolver:

| Site | Resolver flow |
| --- | --- |
| X / Twitter | VxTwitter, then FxTwitter |
| Reddit | Reddit post metadata and RapidSave; gated-video recovery may use the signed-in Reddit page and Coolhost |
| TikTok | TikWM, then MusicalDown |
| Facebook | FBDown |
| Instagram | ddinstagram mirror |

Resolvers receive the public post URL when you choose to queue the video. Cool Pills validates the returned media URL against expected hosts. Availability and behavior of third-party services can change; failures may leave the original link for Coolhost recovery or produce a clear error.

## Audio and video formats

Reddit can expose separate audio and video streams. Cool Pills avoids queuing a video-only stream for regular videos because it would lose audio. It seeks a merged MP4, and will only fall back to the signed-in Reddit DASH path for Coolhost processing when required. For other sites, support depends on what the resolver or native player exposes.

See [Privacy and permissions](Privacy-and-Permissions) for information about what data is sent to resolver services and Coolhost.
