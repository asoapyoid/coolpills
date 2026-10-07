/* Read authenticated Reddit post media metadata in the page's own origin. */
'use strict';

(() => {
  const CHANNEL = 'coolpills:reddit-media';
  const isRedditHost = (hostname) => {
    const host = hostname.toLowerCase();
    return host === 'reddit.com' || host.endsWith('.reddit.com') ||
      host === 'redd.it' || host.endsWith('.redd.it');
  };

  function postIdFromUrl(value) {
    try {
      const url = new URL(value);
      if (!isRedditHost(url.hostname)) return null;
      const match = url.pathname.match(/\/comments\/([a-z0-9]+)/i) ||
        ((url.hostname === 'redd.it' || url.hostname.endsWith('.redd.it')) && url.pathname.match(/^\/([a-z0-9]+)\/?$/i));
      return match ? match[1] : null;
    } catch (_) {
      return null;
    }
  }

  function findDashMedia(data) {
    const visit = (value) => {
      if (!value || typeof value !== 'object') return null;
      if (Array.isArray(value)) {
        for (const item of value) {
          const result = visit(item);
          if (result) return result;
        }
        return null;
      }
      const video = value.secure_media && value.secure_media.reddit_video ||
        value.media && value.media.reddit_video ||
        value.reddit_video || value.reddit_video_preview;
      if (video && video.dash_url) {
        try {
          const url = new URL(video.dash_url);
          if (url.protocol === 'https:' && url.hostname === 'v.redd.it' &&
              /\/DASHPlaylist\.mpd$/i.test(url.pathname)) {
            const title = typeof value.title === 'string' ? value.title.trim().slice(0, 200) : '';
            const rawDuration = Number(video.duration);
            return {
              dashUrl: url.href,
              title: title || null,
              duration: Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration < 172800
                ? Math.round(rawDuration) : null,
              thumbnail: typeof value.thumbnail === 'string' && /^https?:\/\//i.test(value.thumbnail)
                ? value.thumbnail : null,
            };
          }
        } catch (_) {
          return null;
        }
      }
      for (const item of Object.values(value)) {
        const result = visit(item);
        if (result) return result;
      }
      return null;
    };
    return visit(data);
  }

  window.addEventListener('message', async (event) => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin ||
        !message || message.channel !== CHANNEL || message.type !== 'get-dash' ||
        typeof message.id !== 'string') return;

    const postId = postIdFromUrl(message.postUrl);
    let media = null;
    let error = null;
    if (!postId) {
      error = 'The Reddit post URL is not valid for this page.';
    } else {
      try {
        const endpoint = new URL('/comments/' + encodeURIComponent(postId) + '.json?raw_json=1', location.origin);
        const response = await fetch(endpoint.href, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) {
          error = 'Reddit media metadata returned HTTP ' + response.status + '.';
        } else {
          media = findDashMedia(await response.json());
          if (!media) error = 'Reddit did not expose a direct DASH playlist for this post.';
        }
      } catch (_) {
        error = 'Could not read Reddit media metadata from the signed-in page.';
      }
    }
    window.postMessage({ channel: CHANNEL, type: 'dash-result', id: message.id, ...media, error }, location.origin);
  });
})();
