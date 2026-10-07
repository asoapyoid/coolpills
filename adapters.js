/* Cool Pills — adapters.js
 * Platform adapters. Each adapter exposes:
 *   id, label, hosts (RegExp), supported ('yes'|'maybe'|'no' — whether Coolhole can likely play it)
 *   resolve(stack)  → { key, rect(), place, ctx() } | null   (optional; default = <video> under pointer)
 *   context(video)  → { url, title, duration, thumbnail, supported, ... }
 *
 * FUTURE: when supported === 'no', CQ.hooks.uploadUnsupported(ctx) may upload to coolhost.ca.
 */
(() => {
  'use strict';
  const CQ = (self.CQ = self.CQ || {});
  if (CQ.adapters) return;
  CQ.hooks = CQ.hooks || { uploadUnsupported: null };

  const clean = CQ.cleanTitle;
  const meta = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute('content') : null;
  };
  const pageTitle = () =>
    clean(meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]') || document.title);
  const pageImage = () => meta('meta[property="og:image"]') || null;
  const abs = (href) => {
    try {
      return new URL(href, location.href).href;
    } catch (_) {
      return null;
    }
  };
  const isNativeCoolholeUrl = (value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const path = url.pathname;
      if (url.protocol === 'rtmp:' || /\.m3u8$/i.test(path) || /\.json$/i.test(path)) return true;
      if ([
        'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'soundcloud.com',
        'twitch.tv', 'clips.twitch.tv', 'livestream.com', 'streamable.com',
        'docs.google.com', 'drive.google.com', 'bitchute.com', 'nicovideo.jp', 'odysee.com',
      ].includes(host)) {
        if (host === 'livestream.com') return /^\/accounts\/\d+\/events\/\d+(?:\/|$)/.test(path);
        if (host === 'docs.google.com' || host === 'drive.google.com') {
          return path.startsWith('/file/') || path === '/open';
        }
        if (host === 'bitchute.com') return path.startsWith('/video/');
        if (host === 'nicovideo.jp') return path.startsWith('/watch/');
        if (host === 'odysee.com') return /^\/@[^/]+(?:\/|:)[^/]+/.test(path);
        return true;
      }
      if (host.endsWith('.bandcamp.com') && path.startsWith('/track/')) return true;
      const peerTubePath = path.match(/^\/(?:w|videos\/watch)\/([^/]+)/);
      if (peerTubePath && (/^[a-zA-Z0-9]{22}$/.test(peerTubePath[1]) ||
        /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(peerTubePath[1]))) return true;
      return /\.(?:mp4|mov|flv|webm|mkv|ogg|ogv|m4v)$/i.test(path);
    } catch (_) {
      return false;
    }
  };
  // Native link rules mirror CyTube's parser and player map; unknown sites must expose MP4 first.
  CQ.isNativeCoolholeUrl = isNativeCoolholeUrl;
  const textOf = (sel, root = document) => {
    const el = root.querySelector(sel);
    return el ? clean(el.getAttribute('data-title') || el.textContent) : null;
  };
  const durOf = (v) =>
    v && Number.isFinite(v.duration) && v.duration > 0 && v.duration < 172800 ? Math.floor(v.duration) : null;
  const directVideoUrl = (video) => {
    if (!video) return null;
    const sources = [video.currentSrc, video.src, ...Array.from(video.querySelectorAll('source[src]'), (source) => source.src)];
    const hls = [];
    for (const source of sources) {
      if (!source || /^blob:/i.test(source)) continue;
      const url = abs(source);
      if (!url || !/^https?:/i.test(url)) continue;
      let parsed;
      try {
        parsed = new URL(url);
      } catch (_) {
        continue;
      }
      if (/\.mp4$/i.test(parsed.pathname) ||
        /^(?:video_mp4|video\/mp4)$/i.test(parsed.searchParams.get('mime_type') || '')) return url;
      if (/\.m3u8$/i.test(parsed.pathname)) hls.push(url);
    }
    return hls[0] || null;
  };
  const nativeOrDirect = (video, pageUrl) =>
    isNativeCoolholeUrl(pageUrl) ? pageUrl : directVideoUrl(video) || pageUrl;

  /** closest() that crosses shadow-DOM boundaries */
  const closestDeep = (node, sel) => {
    let n = node;
    while (n) {
      if (n.nodeType === 1 && n.matches && n.matches(sel)) return n;
      n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
    }
    return null;
  };

  /** elementsFromPoint that also descends into open shadow roots */
  CQ.deepStack = (x, y) => {
    const out = [];
    const seen = new Set();
    const walk = (root) => {
      let list;
      try {
        list = root.elementsFromPoint(x, y);
      } catch (_) {
        return;
      }
      for (const el of list) {
        if (seen.has(el)) continue;
        seen.add(el);
        out.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return out;
  };

  /** Default resolver: a sizeable <video> under the pointer; pill sits top-right of it */
  const resolveVideo = (adapter, stack) => {
    for (const el of stack) {
      if (el.tagName !== 'VIDEO') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 240 || r.height < 135) continue;
      return {
        key: el,
        rect: () => el.getBoundingClientRect(),
        place: 'video-top-right',
        ctx: () => adapter.context(el),
      };
    }
    return null;
  };
  const SOCIAL_POST = 'article, [role="article"], shreddit-post, [data-testid="post-container"]';
  const VIDEO_MARKER = 'video, [data-testid*="video" i], [data-e2e*="video" i], [aria-label*="video" i]';
  const hasVideoSignal = (post) => {
    if (!post) return false;
    if (post.matches('shreddit-post[post-type="video"], [data-post-type="video"], [data-media-type="video"]')) return true;
    if (post.querySelector(VIDEO_MARKER)) return true;
    return !!post.querySelector('a[href*="/reel/"], a[href*="/reels/"], a[href*="/watch/"], a[href*="/videos/"]');
  };
  const resolveSocialMedia = (adapter, stack) => {
    for (const el of stack) {
      if (!el || !el.tagName) continue;
      const isVideo = el.tagName === 'VIDEO';
      const isImage = el.tagName === 'IMG';
      const isVideoSurface = !isVideo && !isImage &&
        el.matches('[data-testid*="video" i], [data-e2e*="video" i], [aria-label*="video" i]');
      if (!isVideo && !isImage && !isVideoSurface) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 70) continue;
      if (isImage) {
        const post = closestDeep(el, SOCIAL_POST);
        if (!hasVideoSignal(post)) continue;
      }
      return {
        key: el,
        rect: () => el.getBoundingClientRect(),
        place: 'video-top-right',
        ctx: () => adapter.context(el),
      };
    }
    return null;
  };

  const base = (video, url, title, supported) => ({
    url,
    title: clean(title) || pageTitle(),
    duration: durOf(video),
    durationLabel: durOf(video) != null ? CQ.formatDuration(durOf(video)) : null,
    thumbnail: video && video.poster ? abs(video.poster) : pageImage(),
    supported,
  });
  const linkIn = (video, root, sel) => {
    const scope = closestDeep(video, root);
    const a = scope && scope.querySelector(sel);
    return a ? abs(a.getAttribute('href')) : null;
  };

  // ── YouTube ──────────────────────────────────────────────────────
  const CARD_SEL = [
    'ytd-rich-item-renderer', 'ytd-rich-grid-media', 'ytd-grid-video-renderer', 'ytd-video-renderer',
    'ytd-compact-video-renderer', 'ytd-playlist-video-renderer', 'ytd-reel-item-renderer',
    'reel-item-renderer', 'yt-lockup-view-model', 'ytd-lockup-view-model', 'shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model', 'ytm-rich-item-renderer', 'ytm-video-with-context-renderer',
    'ytm-compact-video-renderer', 'ytm-reel-item-renderer',
  ].join(',');

  const ytIdFromHref = (href) => {
    try {
      const u = new URL(href, location.href);
      if (/(^|\.)youtu\.be$/.test(u.hostname)) return u.pathname.slice(1).split('/')[0] || null;
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/);
      if (m) return m[1];
    } catch (_) {
      /* ignore */
    }
    return null;
  };
  const ytWatchId = () =>
    location.pathname === '/watch'
      ? new URLSearchParams(location.search).get('v')
      : (location.pathname.match(/^\/shorts\/([^/?]+)/) || [])[1] || null;
  const onShortsPage = () =>
    /\/shorts\//i.test(location.pathname) ||
    !!document.querySelector('ytd-reel-video-renderer[is-active], #shorts-player');

  const ytCardLinks = (card) =>
    card.querySelectorAll(
      'a#thumbnail[href], a#video-title-link[href], a[href*="/watch"], a[href*="/shorts/"]'
    );
  const ytCardId = (card) => {
    for (const link of ytCardLinks(card)) {
      const id = ytIdFromHref(link.href);
      if (id) return id;
    }
    return null;
  };
  const ytCardForTarget = (node) => {
    let card = closestDeep(node, CARD_SEL);
    if (!card) return null;
    const id = ytCardId(card);
    if (!id) return null;
    let parent = card.parentElement;
    while (parent) {
      if (parent.matches && parent.matches(CARD_SEL) && ytCardId(parent) === id) card = parent;
      parent = parent.parentElement || (parent.getRootNode && parent.getRootNode().host) || null;
    }
    return { card, id };
  };
  const ytCardAnchor = (card, id) => {
    for (const link of ytCardLinks(card)) {
      if (ytIdFromHref(link.href) === id) return link;
    }
    return card;
  };
  const ytCardTitle = (card) => {
    const t =
      card.querySelector('#video-title') ||
      card.querySelector('a#video-title-link') ||
      card.querySelector('h3 a') ||
      card.querySelector('h3') ||
      card.querySelector('span.yt-core-attributed-string') ||
      card.querySelector('a[title]');
    if (t) {
      const c = clean(t.getAttribute('title')) || clean(t.textContent);
      if (c) return c;
    }
    const a = card.querySelector('a#thumbnail, a[href*="/watch"]');
    return clean((a && a.getAttribute('aria-label') || '').replace(/\s+by\s+.+$/i, ''));
  };

  const parseDurationText = (text) => {
    const raw = String(text || '').trim();
    if (!raw || /^(live|premiere|upcoming|new)$/i.test(raw)) return null;
    const colon = raw.match(/\b(\d{1,2}:(?:\d{1,2}:)?\d{2})\b/);
    if (colon) {
      const p = colon[1].split(':').map(Number);
      return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
    }
    let total = 0;
    const h = raw.match(/(\d+)\s*h(?:our)?s?/i);
    const m = raw.match(/(\d+)\s*m(?:in(?:ute)?s?)?/i);
    const s = raw.match(/(\d+)\s*s(?:ec(?:ond)?s?)?/i);
    if (h) total += +h[1] * 3600;
    if (m) total += +m[1] * 60;
    if (s) total += +s[1];
    return total > 0 ? total : null;
  };
  const deepQueryAll = (root, selector) => {
    const out = [];
    const visit = (node) => {
      if (!node) return;
      try {
        if (node.querySelectorAll) node.querySelectorAll(selector).forEach((e) => out.push(e));
        if (node.shadowRoot) visit(node.shadowRoot);
      } catch (_) {
        /* ignore */
      }
      for (const c of node.children || []) visit(c);
    };
    visit(root);
    return out;
  };
  const SHORTS = { duration: null, durationLabel: 'SHRT' };
  const ytCardDuration = (card) => {
    if (card.querySelector('a[href*="/shorts/"]') || /shorts|reel/i.test(card.tagName)) return SHORTS;
    const texts = [];
    [
      'ytd-thumbnail-overlay-time-status-renderer', '.yt-badge-shape__text', 'badge-shape',
      'yt-thumbnail-badge-view-model', '#overlays #text',
    ].forEach((sel) =>
      deepQueryAll(card, sel).forEach((e) => {
        texts.push(e.textContent, e.getAttribute && e.getAttribute('aria-label'));
      })
    );
    texts.push(card.getAttribute('aria-label'));
    card.querySelectorAll('a#thumbnail, a[href*="/watch"]').forEach((a) => texts.push(a.getAttribute('aria-label')));
    for (const t of texts) {
      const sec = parseDurationText(t);
      if (sec != null) return { duration: sec, durationLabel: CQ.formatDuration(sec) };
    }
    return { duration: null, durationLabel: null };
  };
  const ytWatchDuration = () => {
    if (onShortsPage()) return SHORTS;
    const v = document.querySelector('#movie_player video, video.html5-main-video, video');
    const sec = durOf(v);
    if (sec != null) return { duration: sec, durationLabel: CQ.formatDuration(sec) };
    const t = parseDurationText((document.querySelector('.ytp-time-duration') || {}).textContent);
    return t != null
      ? { duration: t, durationLabel: CQ.formatDuration(t) }
      : { duration: null, durationLabel: null };
  };
  const ytWatchTitle = () => {
    const el =
      document.querySelector('ytd-watch-metadata h1 yt-formatted-string') ||
      document.querySelector('h1 yt-formatted-string') ||
      document.querySelector('yt-shorts-video-title-view-model h2');
    return clean(el && el.textContent) || clean(document.title.replace(/\s*-\s*YouTube\s*$/i, ''));
  };
  const ytCtx = (id, title, dur) => ({
    videoId: id,
    url: 'https://www.youtube.com/watch?v=' + id,
    title,
    ...dur,
    thumbnail: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg',
    supported: 'yes',
  });

  const findShare = (roots) => {
    for (const root of roots.filter(Boolean)) {
      const btns = root.querySelectorAll('button, a[role="button"], yt-button-view-model button');
      for (const b of btns) {
        const lab = (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').toLowerCase();
        if (!/\bshare\b/.test(lab)) continue;
        const r = b.getBoundingClientRect();
        if (r.width > 4 && r.height > 4) return b;
      }
    }
    return null;
  };
  let shareCache = { at: 0, el: null, shorts: false };
  const currentShare = () => {
    if (Date.now() - shareCache.at < 600) return shareCache;
    const shorts = onShortsPage();
    const el = shorts
      ? findShare([
          document.querySelector('ytd-reel-video-renderer[is-active]'),
          document.querySelector('ytd-reel-player-overlay-renderer'),
        ])
      : findShare([
          document.querySelector('#actions'),
          document.querySelector('ytd-watch-metadata'),
        ]);
    shareCache = { at: Date.now(), el, shorts };
    return shareCache;
  };
  const youtube = {
    id: 'youtube',
    label: 'YouTube',
    hosts: /(^|\.)(youtube\.[a-z.]+|youtu\.be)$/i,
    supported: 'yes',
    resolve(stack) {
      for (const el of stack) {
        const target = ytCardForTarget(el);
        if (!target) continue;
        const { card, id } = target;
        return {
          key: card,
          rect: () => ytCardAnchor(card, id).getBoundingClientRect(),
          place: 'video-top-right',
          ctx: () => ytCtx(id, ytCardTitle(card), ytCardDuration(card)),
        };
      }
      if (/^\/(watch|shorts)/.test(location.pathname)) {
        const sh = currentShare();
        if (sh.el && stack.some((e) => e === sh.el || sh.el.contains(e))) {
          return {
            key: sh.el,
            rect: () => sh.el.getBoundingClientRect(),
            place: sh.shorts ? 'right' : 'above',
            ctx: () => this.watchContext(),
          };
        }
      }
      return null;
    },
    watchContext() {
      const id = ytWatchId();
      return id ? ytCtx(id, ytWatchTitle(), ytWatchDuration()) : null;
    },
    context() {
      return this.watchContext();
    },
  };

  // ── other platforms ──────────────────────────────────────────────
  const vimeo = {
    id: 'vimeo', label: 'Vimeo', hosts: /(^|\.)vimeo\.com$/i, supported: 'yes',
    context(v) {
      const link = linkIn(v, 'article, li, [data-clip-id], .clip_grid_item', 'a[href*="vimeo.com/"], a[href^="/"]');
      const url = /vimeo\.com\/(\d+|channels|groups)/.test(location.href) ? location.href : link || location.href;
      return base(v, nativeOrDirect(v, url), textOf('[data-title]') || pageTitle(), 'yes');
    },
  };

  const twitch = {
    id: 'twitch', label: 'Twitch', hosts: /(^|\.)twitch\.tv$/i, supported: 'yes',
    context(v) {
      const stream = textOf('[data-a-target="stream-title"]');
      const channel = textOf('[data-a-target="user-display-name"]') || textOf('h1');
      const clipLink = linkIn(v, 'article, [data-a-target="clips-card"], [data-a-target="clip-card"]',
        'a[href*="/clip/"], a[href*="clips.twitch.tv/"]');
      const url = /\/clip\//i.test(location.pathname) || location.hostname === 'clips.twitch.tv'
        ? location.href : clipLink || location.origin + location.pathname;
      const title = textOf('[data-a-target="video-title"]') ||
        (stream ? (channel ? channel + ' — ' + stream : stream) : pageTitle());
      return base(v, nativeOrDirect(v, url), title, 'yes');
    },
  };

  const tiktok = {
    id: 'tiktok', label: 'TikTok', hosts: /(^|\.)tiktok\.com$/i, supported: 'no',
    context(v) {
      const link = linkIn(v, 'article, [data-e2e="recommend-list-item-container"], [data-e2e="user-post-item"]', 'a[href*="/video/"]');
      const url = /\/video\//.test(location.pathname) ? location.href : link || location.href;
      const desc = textOf('[data-e2e="browse-video-desc"]') || textOf('[data-e2e="video-desc"]');
      const direct = directVideoUrl(v);
      const context = base(v, nativeOrDirect(v, url), desc || meta('meta[property="og:title"]'), direct ? 'yes' : 'no');
      if (!direct) {
        context.platform = 'tiktok';
        context.postUrl = url;
      }
      return context;
    },
  };

  const instagram = {
    id: 'instagram', label: 'Instagram', hosts: /(^|\.)(instagram|kkinstagram|ddinstagram)\.com$/i, supported: 'no',
    context(v) {
      const link = linkIn(v, 'article', 'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]');
      const url = /\/(p|reel|reels)\//.test(location.pathname) ? location.href : link || location.href;
      const direct = directVideoUrl(v);
      const context = base(v, nativeOrDirect(v, url), pageTitle(), direct ? 'yes' : 'no');
      if (!direct) {
        context.platform = 'instagram';
        context.postUrl = url;
      }
      return context;
    },
  };

  const twitter = {
    id: 'twitter', label: 'Twitter / X', hosts: /(^|\.)(twitter|x)\.com$/i, supported: 'no',
    resolve(stack) {
      for (const el of stack) {
        if (!el || !el.tagName) continue;
        const isMedia = el.tagName === 'VIDEO' || el.tagName === 'IMG' ||
          el.matches('[data-testid*="video" i], [data-testid*="gif" i], [aria-label*="video" i], [aria-label*="gif" i]');
        if (!isMedia) continue;
        const tweet = closestDeep(el, 'article[data-testid="tweet"], article');
        if (!tweet) continue;
        const gifLabel = (node) => ['aria-label', 'title', 'alt', 'data-testid']
          .some((name) => /\bgif\b/i.test(node.getAttribute(name) || ''));
        let node = el;
        while (node && node !== tweet) {
          if (gifLabel(node)) return null;
          node = node.parentElement;
        }
        const player = closestDeep(el, '[data-testid="videoPlayer"], [data-testid*="gif" i]');
        if (player && Array.from(player.querySelectorAll('[aria-label], [title], [alt], [data-testid]')).some(gifLabel)) {
          return null;
        }
        const mediaRect = el.getBoundingClientRect();
        const hasGifBadge = Array.from(tweet.querySelectorAll('span')).some((badge) => {
          if ((badge.textContent || '').trim().toUpperCase() !== 'GIF') return false;
          const rect = badge.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          return rect.width > 0 && rect.height > 0 &&
            centerX >= mediaRect.left && centerX <= mediaRect.right &&
            centerY >= mediaRect.top && centerY <= mediaRect.bottom;
        });
        if (hasGifBadge) return null;
      }
      return resolveVideo(this, stack) || resolveSocialMedia(this, stack);
    },
    context(v) {
      const tweet = closestDeep(v, 'article[data-testid="tweet"], article');
      let url = location.href;
      let title = null;
      if (tweet) {
        const time = tweet.querySelector('a[href*="/status/"] time');
        const link = (time && time.closest('a')) || tweet.querySelector('a[href*="/status/"]');
        if (link) url = abs(link.getAttribute('href').split('/video/')[0]);
        title = textOf('[data-testid="tweetText"]', tweet);
        if (!title) {
          const user = tweet.querySelector('[data-testid="User-Name"]');
          title = user ? 'Post by ' + clean(user.textContent) : null;
        }
      }
      const direct = directVideoUrl(v);
      const context = base(v, nativeOrDirect(v, url), title && title.slice(0, 120), direct ? 'yes' : 'no');
      if (!direct) {
        context.platform = 'x';
        context.postUrl = url;
      }
      return context;
    },
  };

  const reddit = {
    id: 'reddit', label: 'Reddit', hosts: /(^|\.)reddit\.com$|(^|\.)redd\.it$/i, supported: 'no',
    context(v) {
      const post = closestDeep(v, 'shreddit-post, article, [data-testid="post-container"], .thing');
      let url = location.href;
      let title = null;
      if (post) {
        const perma = post.getAttribute('permalink') || post.getAttribute('content-href') ||
          (post.querySelector('a[data-click-id="comments"], a[href*="/comments/"]') || {}).getAttribute('href');
        if (perma) url = abs(perma);
        title = clean(post.getAttribute('post-title')) || textOf('[slot="title"], h1, h3', post);
      }
      const direct = directVideoUrl(v);
      const context = base(v, nativeOrDirect(v, url), title, direct ? 'yes' : 'no');
      context.platform = 'reddit';
      context.postUrl = url;
      return context;
    },
  };

  const dailymotion = {
    id: 'dailymotion', label: 'Dailymotion', hosts: /(^|\.)dailymotion\.com$/i, supported: 'yes',
    context(v) {
      const link = linkIn(v, 'article, li', 'a[href*="/video/"]');
      const url = /\/video\//.test(location.pathname) ? location.href : link || location.href;
      return base(v, nativeOrDirect(v, url), pageTitle(), 'yes');
    },
  };

  const kick = {
    id: 'kick', label: 'Kick', hosts: /(^|\.)kick\.com$/i, supported: 'no',
    context(v) {
      const direct = directVideoUrl(v);
      const url = location.origin + location.pathname;
      return base(v, nativeOrDirect(v, url), pageTitle() || clean(document.title), direct ? 'yes' : 'no');
    },
  };

  const facebook = {
    id: 'facebook', label: 'Facebook', hosts: /(^|\.)facebook\.com$|^fb\.watch$/i, supported: 'no',
    context(v) {
      const post = closestDeep(v, '[role="article"], article');
      const link = post && post.querySelector(
        'a[href*="/reel/"], a[href*="/watch/"], a[href*="/videos/"], a[href*="/posts/"], ' +
        'a[href*="/permalink/"], a[href*="/share/v/"], a[href*="story.php"], a[href*="fb.watch"]'
      );
      const direct = directVideoUrl(v);
      const title = post && textOf('[data-ad-preview="message"]', post);
      const url = (link && abs(link.getAttribute('href'))) || location.href;
      const context = base(v, nativeOrDirect(v, url), title, direct ? 'yes' : 'no');
      if (!direct) {
        context.platform = 'facebook';
        context.postUrl = url;
      }
      return context;
    },
  };

  const threads = {
    id: 'threads', label: 'Threads', hosts: /(^|\.)threads\.net$/i, supported: 'no',
    context(v) {
      const post = closestDeep(v, 'article');
      const link = post && post.querySelector('a[href*="/post/"]');
      const direct = directVideoUrl(v);
      const title = post && textOf('[data-testid="post-text"], [dir="auto"]');
      const url = (link && abs(link.getAttribute('href'))) || location.href;
      return base(v, nativeOrDirect(v, url), title, direct ? 'yes' : 'no');
    },
  };

  const generic = {
    id: 'generic', label: 'Any HTML5 video', hosts: /./, supported: 'maybe',
    context(v) {
      const direct = directVideoUrl(v);
      return base(v, nativeOrDirect(v, location.href), pageTitle(), direct ? 'yes' : 'maybe');
    },
  };

  const list = [youtube, vimeo, twitch, tiktok, instagram, twitter, reddit, dailymotion, kick, facebook, threads];
  const socialAdapters = new Set([tiktok, instagram, twitter, reddit, kick, facebook, threads]);
  list.forEach((a) => {
    if (!a.resolve) {
      a.resolve = (stack) => resolveVideo(a, stack) ||
        (socialAdapters.has(a) ? resolveSocialMedia(a, stack) : null);
    }
  });
  generic.resolve = (stack) => resolveVideo(generic, stack);

  CQ.adapters = {
    list: list.map((a) => ({ id: a.id, label: a.label })),
    forHost(host) {
      const h = String(host || '').replace(/^www\./, '');
      return list.find((a) => a.hosts.test(h)) || generic;
    },
  };

  /** Per-site toggle: adapter id for known sites, hostname for everything else */
  CQ.siteEnabled = (host, settings) => {
    const s = settings || CQ.settings.cur;
    const a = CQ.adapters.forHost(host);
    const dis = s.disabledSites || [];
    if (a.id !== 'generic') return !dis.includes(a.id);
    return s.genericEnabled === true && !dis.includes(String(host).replace(/^www\./, ''));
  };
})();
