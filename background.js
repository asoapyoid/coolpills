/* Cool Pills — background.js
 * MV3 service worker (Chrome) / event page (Firefox). It is stateless on purpose: it relays
 * messages between tabs, arbitrates an auto-queue lock, fetches titles/durations cross-origin,
 * and handles keyboard commands. It never watches the DOM (workers sleep) — auto-queue lives in
 * the Coolhole content script.
 */
'use strict';
const api = typeof browser !== 'undefined' && browser.runtime ? browser : chrome;
const HOLE_URLS = ['https://coolhole.org/*', 'https://new.coolhole.org/*'];
const SETTINGS_KEY = 'cq_settings';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getSettings = async () => {
  try {
    const r = await api.storage.local.get(SETTINGS_KEY);
    return r[SETTINGS_KEY] || {};
  } catch (_) {
    return {};
  }
};

async function holeTabs() {
  try {
    return await api.tabs.query({ url: HOLE_URLS });
  } catch (_) {
    return [];
  }
}
/** Prefer the most recently used Coolhole tab so exactly one tab handles each action */
async function pickHoleTab() {
  const tabs = await holeTabs();
  if (!tabs.length) return null;
  tabs.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return tabs[0];
}

function hashUrl(type, p = {}) {
  if (type === 'cq:work') return 'https://coolhole.org/#cq_work=1&n=' + Date.now();
  let h = 'cq_add=' + encodeURIComponent(p.url || p.videoId || '');
  if (p.title) h += '&cq_title=' + encodeURIComponent(p.title);
  if (p.duration != null) h += '&cq_dur=' + encodeURIComponent(String(p.duration));
  if (p.durationLabel) h += '&cq_dl=' + encodeURIComponent(p.durationLabel);
  if (p.thumbnail) h += '&cq_thumb=' + encodeURIComponent(p.thumbnail);
  if (p.forceQPlus) h += '&cq_q=1';
  if (p.scheduledAt) h += '&cq_at=' + encodeURIComponent(String(p.scheduledAt));
  return 'https://coolhole.org/#' + h + '&n=' + Date.now();
}

async function focusTab(tab) {
  try {
    await api.tabs.update(tab.id, { active: true });
    await api.windows.update(tab.windowId, { focused: true });
  } catch (_) { /* ignore */ }
}

/** Deliver to a live Coolhole tab; if none (or its script isn't ready), open Coolhole with a hash payload */
async function relayToHole(type, payload, { focus = false } = {}) {
  const tab = await pickHoleTab();
  if (tab) {
    for (let i = 0; i < 3; i++) {
      try {
        await api.tabs.sendMessage(tab.id, { type, payload });
        if (focus) await focusTab(tab);
        return { ok: true, via: 'tab' };
      } catch (_) {
        await sleep(450); // content script may still be booting
      }
    }
  }
  if (type === 'cq:unqueue') return { ok: false, via: 'none' };
  await api.tabs.create({ url: hashUrl(type, payload), active: true });
  return { ok: true, via: 'hash' };
}

async function startCoolhostUpload(payload) {
  const source = new URL(String(payload && payload.url || ''));
  if (!['http:', 'https:'].includes(source.protocol)) {
    return { ok: false, error: 'Coolhost only accepts HTTP or HTTPS video links.' };
  }
  if (source.username || source.password) {
    return { ok: false, error: 'Links containing embedded login credentials cannot be sent to Coolhost.' };
  }
  if (source.hostname === 'coolhost.ca' || source.hostname === 'www.coolhost.ca') {
    return { ok: false, error: 'This link is already hosted on Coolhost.' };
  }

  const request = {
    url: source.href,
    title: String(payload.title || '').slice(0, 200),
  };
  const tabs = await api.tabs.query({ url: ['https://coolhost.ca/*', 'https://www.coolhost.ca/*'] });
  tabs.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  for (const tab of tabs) {
    for (let i = 0; i < 3; i++) {
      try {
        await api.tabs.sendMessage(tab.id, { type: 'cq:coolhost-upload', payload: request });
        return { ok: true, via: 'tab' };
      } catch (_) {
        await sleep(450);
      }
    }
  }

  const hash = new URLSearchParams({
    cq_upload: request.url,
    cq_title: request.title,
  });
  await api.tabs.create({ url: 'https://coolhost.ca/#' + hash.toString(), active: false });
  return { ok: true, via: 'new-tab' };
}

function isRedditUrl(value, requirePost = false) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!(host === 'reddit.com' || host.endsWith('.reddit.com') || host === 'redd.it' || host.endsWith('.redd.it'))) {
      return false;
    }
    if (!requirePost) return true;
    return /\/comments\/[a-z0-9]+(?:\/|$)/i.test(url.pathname) ||
      ((host === 'redd.it' || host.endsWith('.redd.it')) && /^\/[a-z0-9]+\/?$/i.test(url.pathname));
  } catch (_) {
    return false;
  }
}

function isRedditDashUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname === 'v.redd.it' &&
      /\/DASHPlaylist\.mpd$/i.test(url.pathname);
  } catch (_) {
    return false;
  }
}

// ── metadata fetch (CORS-free thanks to host_permissions) ───────────
const ytId = (u) => {
  const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return m ? m[1] : null;
};
const decode = (s) =>
  String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const isoDur = (iso) => {
  const m = String(iso || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.\d+)?S)?$/i);
  if (!m) return null;
  const s = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return s > 0 ? s : null;
};
function durationFromHtml(html) {
  const meta = html.match(/itemprop=["']duration["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]*itemprop=["']duration["']/i);
  if (meta) {
    const d = isoDur(meta[1]);
    if (d != null) return d;
  }
  const len = html.match(/"lengthSeconds"\s*:\s*"?(\d+)"?/);
  if (len && +len[1] > 0 && +len[1] < 604800) return +len[1];
  const ms = html.match(/"approxDurationMs"\s*:\s*"?(\d+)"?/);
  if (ms && +ms[1] > 0) return Math.round(+ms[1] / 1000);
  return null;
}
function titleFromHtml(html) {
  for (const h1 of html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const t = decode(h1[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (t.length > 1 && !/^coolhost$/i.test(t)) return t.slice(0, 120);
  }
  const og = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (og) return decode(og[1]).trim().slice(0, 120);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return decode(t[1]).replace(/\s+/g, ' ').replace(/\s*[-|–•]\s*Coolhost.*$/i, '').trim().slice(0, 120) || null;
  return null;
}
async function fetchText(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { credentials: 'omit', signal: ctl.signal });
    return (await r.text()).slice(0, 1500000);
  } finally {
    clearTimeout(t);
  }
}
async function fetchMeta(url) {
  const out = { title: null, duration: null, thumbnail: null };
  if (!/^https?:\/\//i.test(String(url || ''))) return out;
  if (/\.(mp4|webm|mov|mkv|ogv|m4v)(?:$|[?#])/i.test(url)) return out;
  const id = ytId(url);
  if (id) {
    try {
      const j = JSON.parse(
        await fetchText('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id), 8000)
      );
      out.title = j.title || null;
      out.thumbnail = j.thumbnail_url || null;
    } catch (_) { /* ignore */ }
  }
  try {
    const html = await fetchText(id ? 'https://www.youtube.com/watch?v=' + id : url);
    out.duration = durationFromHtml(html);
    if (!out.title) out.title = titleFromHtml(html);
    if (!out.thumbnail) {
      const img = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      if (img) out.thumbnail = decode(img[1]);
    }
  } catch (_) { /* ignore */ }
  return out;
}

function trustedXVideoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'video.twimg.com' &&
      /\.mp4$/i.test(url.pathname) ? url.href : null;
  } catch (_) {
    return null;
  }
}

async function resolveXVideo(postUrl) {
  let post;
  try {
    post = new URL(postUrl);
  } catch (_) {
    return { ok: false, error: 'Invalid X post URL.' };
  }
  if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(post.hostname)) {
    return { ok: false, error: 'Only X/Twitter post links can be resolved.' };
  }
  const match = post.pathname.match(/^\/([^/]+)\/status\/(\d+)/i);
  if (!match) return { ok: false, error: 'Could not find a post ID in the X link.' };

  const postPath = '/' + encodeURIComponent(match[1]) + '/status/' + match[2];
  const providers = [
    { name: 'VxTwitter', url: 'https://api.vxtwitter.com' + postPath },
    { name: 'FxTwitter', url: 'https://api.fxtwitter.com' + postPath },
  ];
  const failures = [];

  for (const provider of providers) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(provider.url, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        failures.push(provider.name + ' returned HTTP ' + response.status);
        continue;
      }

      const data = await response.json();
      const candidates = [];
      const seen = new Set();
      const visit = (value) => {
        if (typeof value === 'string') {
          const url = trustedXVideoUrl(value);
          if (url && !seen.has(url)) {
            seen.add(url);
            candidates.push({ url, thumbnail: null, duration: null });
          }
          return;
        }
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        const url = trustedXVideoUrl(value.url || value.src || value.video_url || value.download_url);
        if (url && !seen.has(url)) {
          seen.add(url);
          const durationMillis = value.duration_millis != null ? value.duration_millis
            : value.duration_ms != null ? value.duration_ms : value.durationMs;
          const durationNumber = Number(durationMillis != null ? durationMillis : value.duration);
          const duration = Number.isFinite(durationNumber) && durationNumber > 0
            ? Math.round(durationMillis != null || durationNumber > 1000 ? durationNumber / 1000 : durationNumber)
            : null;
          candidates.push({
            url,
            thumbnail: value.thumbnail_url || value.thumbnail || value.poster || null,
            duration,
          });
        }
        Object.values(value).forEach(visit);
      };
      visit(data);

      const media = candidates[0];
      if (media) {
        const tweet = data.tweet && typeof data.tweet === 'object' ? data.tweet : data;
        return {
          ok: true,
          url: media.url,
          title: typeof tweet.text === 'string' ? tweet.text.slice(0, 120) : null,
          thumbnail: media.thumbnail,
          duration: media.duration,
        };
      }
      failures.push(provider.name + ' found no downloadable MP4');
    } catch (error) {
      failures.push(provider.name + ' failed (' + (
        error && error.name === 'AbortError' ? 'timed out' : 'network or response error'
      ) + ')');
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    error: 'X video lookup failed: ' + failures.join('; ') + '.',
  };
}

function trustedRedditVideoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'v.redd.it' &&
      /\.mp4$/i.test(url.pathname) ? url.href : null;
  } catch (_) {
    return null;
  }
}

function trustedRapidSaveVideoUrl(value) {
  try {
    const url = new URL(value, 'https://rapidsave.com/');
    return url.protocol === 'https:' && url.hostname === 'sd.rapidsave.com' &&
      /\.mp4$/i.test(url.pathname) ? url.href : null;
  } catch (_) {
    return null;
  }
}

function extractRedditMedia(data) {
  const candidates = [];
  const seen = new Set();
  let title = null;
  let thumbnail = null;
  let duration = null;
  let isGif = false;
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const video = value.secure_media && value.secure_media.reddit_video ||
      value.media && value.media.reddit_video ||
      value.reddit_video || value.reddit_video_preview;
    if (video) {
      const url = trustedRedditVideoUrl(video.fallback_url || video.url);
      if (url && !seen.has(url)) {
        seen.add(url);
        candidates.push(url);
        if (video.is_gif === true || value.is_gif === true) isGif = true;
        if (Number.isFinite(Number(video.duration)) && Number(video.duration) > 0) {
          duration = Math.round(Number(video.duration));
        }
      }
    }
    if (!title && value.permalink && typeof value.title === 'string') title = value.title;
    if (!thumbnail && typeof value.thumbnail === 'string' && /^https?:/i.test(value.thumbnail)) {
      thumbnail = value.thumbnail;
    }
    if (!thumbnail && value.preview && Array.isArray(value.preview.images)) {
      const source = value.preview.images[0] && value.preview.images[0].source;
      if (source && typeof source.url === 'string') thumbnail = source.url.replace(/&amp;/g, '&');
    }
    Object.values(value).forEach(visit);
  };
  visit(data);
  return candidates.length ? {
    url: candidates[0],
    title,
    thumbnail,
    duration,
    isGif,
  } : null;
}

async function resolveRedditVideo(postUrl) {
  let post;
  try {
    post = new URL(postUrl);
  } catch (_) {
    return { ok: false, error: 'Invalid Reddit post URL.' };
  }
  const host = post.hostname.toLowerCase();
  if (host !== 'reddit.com' && !host.endsWith('.reddit.com') && host !== 'redd.it' && !host.endsWith('.redd.it')) {
    return { ok: false, error: 'Only Reddit post links can be resolved.' };
  }
  const match = post.pathname.match(/\/comments\/([a-z0-9]+)/i) || post.pathname.match(/^\/([a-z0-9]+)\/?$/i);
  if (!match) return { ok: false, error: 'Could not find a Reddit post ID in that link.' };

  const postId = match[1];
  const publicPostUrl = post.origin + post.pathname;
  const providers = [
    {
      name: 'Reddit',
      url: 'https://www.reddit.com/comments/' + encodeURIComponent(postId) + '.json?raw_json=1',
      parse: extractRedditMedia,
    },
    {
      name: 'RedditSave',
      url: 'https://rapidsave.com/info?url=' + encodeURIComponent(publicPostUrl),
      parse: (html) => {
        const url = linksFromHtml(html).map(trustedRapidSaveVideoUrl).find(Boolean) || null;
        return url ? { url, title: null, thumbnail: null, duration: null } : null;
      },
      text: true,
    },
  ];
  const failures = [];
  let redditMedia = null;

  for (const provider of providers) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(provider.url, {
        credentials: 'omit',
        headers: { Accept: provider.text ? 'text/html' : 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        failures.push(provider.name + ' returned HTTP ' + response.status);
        continue;
      }
      const data = provider.text ? await response.text() : await response.json();
      const media = provider.parse(data);
      if (media && provider.name === 'Reddit') {
        redditMedia = media;
        continue;
      }
      if (media) return {
        ok: true,
        ...media,
        ...(redditMedia ? {
          title: redditMedia.title,
          thumbnail: redditMedia.thumbnail,
          duration: redditMedia.duration,
        } : {}),
      };
      failures.push(provider.name + (provider.text ? ' found no direct playable MP4 (download endpoints are not queueable)' : ' found no direct MP4'));
    } catch (error) {
      failures.push(provider.name + ' failed (' + (
        error && error.name === 'AbortError' ? 'timed out' : 'network or response error'
      ) + ')');
    } finally {
      clearTimeout(timeout);
    }
  }
  if (redditMedia && redditMedia.isGif) {
    return { ok: true, ...redditMedia };
  }
  if (redditMedia) {
    failures.push('Reddit metadata only provided a video-only stream');
  }
  return { ok: false, error: 'Reddit video lookup failed: ' + failures.join('; ') + '.' };
}

function trustedFacebookVideoUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === 'fbcdn.net' || host.endsWith('.fbcdn.net')) &&
      /\.mp4$/i.test(url.pathname) ? url.href : null;
  } catch (_) {
    return null;
  }
}

function trustedInstagramVideoUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const trustedHost = host === 'fbcdn.net' || host.endsWith('.fbcdn.net') ||
      host === 'cdninstagram.com' || host.endsWith('.cdninstagram.com');
    return url.protocol === 'https:' && trustedHost && /\.mp4$/i.test(url.pathname) ? url.href : null;
  } catch (_) {
    return null;
  }
}

function trustedTikTokVideoUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const trustedHost = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokv.com', 'byteoversea.com', 'ibytedtos.com']
      .some((suffix) => host === suffix || host.endsWith('.' + suffix));
    const isMp4 = /\.mp4$/i.test(url.pathname) || /^(?:video_mp4|video\/mp4)$/i.test(url.searchParams.get('mime_type') || '');
    return url.protocol === 'https:' && trustedHost && isMp4 ? url.href : null;
  } catch (_) {
    return null;
  }
}

function socialHtml(value) {
  return decode(String(value || ''))
    .replace(/\\u002f/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/&#x2f;/gi, '/');
}

function linksFromHtml(html) {
  const source = socialHtml(html);
  const values = [];
  for (const match of source.matchAll(/(?:href|src|content)\s*=\s*["']([^"']+)["']/gi)) {
    values.push(match[1]);
  }
  for (const match of source.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)) {
    values.push(match[0].replace(/[),.;]+$/, ''));
  }
  return [...new Set(values)];
}

async function fetchSocialText(url, init = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });
    return { response, text: (await response.text()).slice(0, 1500000) };
  } finally {
    clearTimeout(timeout);
  }
}

function validPublicPost(value, platform) {
  let url;
  try {
    url = new URL(value);
  } catch (_) {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const matches = {
    facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'mbasic.facebook.com', 'fb.watch'].includes(host),
    instagram: ['instagram.com', 'www.instagram.com', 'm.instagram.com', 'ddinstagram.com', 'www.ddinstagram.com',
      'kkinstagram.com', 'www.kkinstagram.com'].includes(host),
    tiktok: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'].includes(host),
  };
  return matches[platform] ? url : null;
}

async function resolveFacebookVideo(postUrl) {
  const post = validPublicPost(postUrl, 'facebook');
  if (!post) return { ok: false, error: 'Only public Facebook video links can be resolved.' };
  const failures = [];
  try {
    const { response, text } = await fetchSocialText('https://fbdown.net/download.php', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://fbdown.net/',
      },
      body: new URLSearchParams({ URLz: post.href }),
    });
    if (!response.ok) {
      failures.push('FBDown returned HTTP ' + response.status);
    } else {
      const url = linksFromHtml(text).map(trustedFacebookVideoUrl).find(Boolean);
      if (url) return { ok: true, url };
      failures.push('FBDown did not return a direct MP4');
    }
  } catch (error) {
    failures.push('FBDown request failed (' + (
      error && error.name === 'AbortError' ? 'timed out' : 'service unavailable'
    ) + ')');
  }
  return { ok: false, error: 'Facebook video lookup failed: ' + failures.join('; ') + '.' };
}

async function resolveInstagramVideo(postUrl) {
  const post = validPublicPost(postUrl, 'instagram');
  if (!post || !/\/(?:p|reel|reels|tv)\//i.test(post.pathname)) {
    return { ok: false, error: 'Only public Instagram post and reel links can be resolved.' };
  }
  const mirror = new URL(post.href);
  mirror.hostname = 'ddinstagram.com';
  mirror.search = '';
  try {
    const { response, text } = await fetchSocialText(mirror.href, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    if (!response.ok) {
      return { ok: false, error: 'Instagram mirror returned HTTP ' + response.status + '.' };
    }
    const links = linksFromHtml(text);
    const url = links.map(trustedInstagramVideoUrl).find(Boolean);
    if (!url) return { ok: false, error: 'Instagram mirror did not expose a direct MP4.' };
    return { ok: true, url, title: titleFromHtml(text) };
  } catch (error) {
    return {
      ok: false,
      error: 'Instagram video lookup failed (' + (
        error && error.name === 'AbortError' ? 'timed out' : 'mirror unavailable'
      ) + ').',
    };
  }
}

async function resolveTikTokVideo(postUrl) {
  const post = validPublicPost(postUrl, 'tiktok');
  if (!post) return { ok: false, error: 'Only TikTok video links can be resolved.' };
  const failures = [];

  try {
    const { response, text } = await fetchSocialText('https://tikwm.com/api/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ url: post.href, hd: '1' }),
    });
    if (!response.ok) {
      failures.push('TikWM returned HTTP ' + response.status);
    } else {
      const result = JSON.parse(text);
      const data = result && result.code === 0 && result.data;
      const url = data && [data.hdplay, data.play, data.wmplay].map(trustedTikTokVideoUrl).find(Boolean);
      if (url) {
        return {
          ok: true,
          url,
          title: typeof data.title === 'string' ? data.title.slice(0, 120) : null,
          duration: Number.isFinite(Number(data.duration)) && Number(data.duration) > 0
            ? Math.round(Number(data.duration)) : null,
          thumbnail: typeof data.cover === 'string' ? data.cover : data.origin_cover || null,
        };
      }
      failures.push(result && result.msg ? 'TikWM: ' + String(result.msg).slice(0, 100) : 'TikWM found no trusted MP4');
    }
  } catch (error) {
    failures.push('TikWM request failed (' + (
      error && error.name === 'AbortError' ? 'timed out' : 'service or response error'
    ) + ')');
  }

  try {
    const { response, text } = await fetchSocialText('https://musicaldown.com/en', {
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) {
      failures.push('MusicalDown returned HTTP ' + response.status);
    } else {
      const tokenFields = new URLSearchParams();
      let urlField = null;
      for (const input of text.matchAll(/<input\b[^>]*>/gi)) {
        const tag = input[0];
        const name = tag.match(/\bname=["']([^"']+)["']/i);
        const value = tag.match(/\bvalue=["']([^"']*)["']/i);
        if (!name) continue;
        const fieldName = decode(name[1]);
        if (/(?:url|link|_syr)/i.test(fieldName)) {
          urlField = fieldName;
        } else if (value) {
          tokenFields.set(fieldName, decode(value[1]));
        }
      }
      if (urlField) tokenFields.set(urlField, post.href);
      else tokenFields.set('id', post.href);
      const { response: result, text: html } = await fetchSocialText('https://musicaldown.com/download', {
        method: 'POST',
        headers: {
          Accept: 'text/html',
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://musicaldown.com/en',
        },
        body: tokenFields,
      });
      if (!result.ok) {
        failures.push('MusicalDown returned HTTP ' + result.status);
      } else {
        const url = linksFromHtml(html).map(trustedTikTokVideoUrl).find(Boolean);
        if (url) return { ok: true, url };
        failures.push('MusicalDown found no trusted MP4');
      }
    }
  } catch (error) {
    failures.push('MusicalDown request failed (' + (
      error && error.name === 'AbortError' ? 'timed out' : 'service or response error'
    ) + ')');
  }
  return { ok: false, error: 'TikTok video lookup failed: ' + failures.join('; ') + '.' };
}

async function resolveSocialVideo(platform, postUrl) {
  if (platform === 'x') return resolveXVideo(postUrl);
  if (platform === 'reddit') return resolveRedditVideo(postUrl);
  if (platform === 'facebook') return resolveFacebookVideo(postUrl);
  if (platform === 'instagram') return resolveInstagramVideo(postUrl);
  if (platform === 'tiktok') return resolveTikTokVideo(postUrl);
  return { ok: false, error: 'No resolver is available for that site.' };
}

// ── auto-queue lock (only one Coolhole tab drains Q+ at a time) ─────
let lock = { tabId: null, until: 0 };

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return;
  (async () => {
    switch (msg.type) {
      case 'cq:queue':
        return relayToHole('cq:queue', msg.payload);
      case 'cq:coolhost-upload': {
        const origin = sender.url || sender.tab && sender.tab.url || '';
        const fromCoolhole = /^https:\/\/(?:new\.)?coolhole\.org\//i.test(origin);
        const fromReddit = msg.payload && msg.payload.platform === 'reddit' &&
          isRedditUrl(origin) && isRedditUrl(msg.payload.postUrl, true) &&
          isRedditDashUrl(msg.payload.url);
        if (!fromCoolhole && !fromReddit) {
          return { ok: false, error: 'Coolhost recovery can only be started from Coolhole or a verified Reddit media manifest.' };
        }
        return startCoolhostUpload(msg.payload || {});
      }
      case 'cq:coolhost-status': {
        const origin = sender.url || sender.tab && sender.tab.url || '';
        if (!/^https:\/\/(?:www\.)?coolhost\.ca\//i.test(origin)) {
          return { ok: false, error: 'Invalid Coolhost status sender.' };
        }
        const tab = await pickHoleTab();
        if (!tab) return { ok: false, error: 'No Coolhole tab is open to show the upload result.' };
        await api.tabs.sendMessage(tab.id, { type: 'cq:coolhost-status', payload: msg.payload || {} });
        return { ok: true };
      }
      case 'cq:unqueue':
        return relayToHole('cq:unqueue', msg.payload);
      case 'cq:work': {
        const s = await getSettings();
        return relayToHole('cq:work', {}, { focus: s.autoFocus !== false });
      }
      case 'cq:fetch-meta':
        return fetchMeta(msg.url);
      case 'cq:resolve-social-video':
        return resolveSocialVideo(msg.platform, msg.postUrl);
      case 'cq:lock': {
        const id = sender.tab ? sender.tab.id : -1;
        const now = Date.now();
        if (lock.tabId !== null && lock.tabId !== id && lock.until > now) return { granted: false };
        lock = { tabId: id, until: now + (msg.ttl || 4000) };
        return { granted: true };
      }
      case 'cq:slot-open': {
        // A slot opened: wake every OTHER Coolhole tab; the lock decides who actually queues.
        const tabs = await holeTabs();
        await Promise.all(
          tabs
            .filter((t) => !sender.tab || t.id !== sender.tab.id)
            .map((t) => api.tabs.sendMessage(t.id, { type: 'cq:try-auto' }).catch(() => null))
        );
        return { ok: true };
      }
      case 'cq:open-options':
        await api.runtime.openOptionsPage();
        return { ok: true };
      default:
        return null;
    }
  })()
    .then((r) => sendResponse(r))
    .catch((e) => sendResponse({ ok: false, error: String(e && e.message) }));
  return true; // async response
});

// ── keyboard shortcuts ───────────────────────────────────────────────
api.commands.onCommand.addListener(async (cmd) => {
  try {
    const settings = await getSettings();
    if (settings.keyboardShortcutsEnabled === false) return;
    if (cmd === 'queue-current') {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id != null) await api.tabs.sendMessage(tab.id, { type: 'cq:queue-current' }).catch(() => null);
    } else if (cmd === 'work') {
      const s = await getSettings();
      await relayToHole('cq:work', {}, { focus: s.autoFocus !== false });
    } else if (cmd === 'toggle-panel') {
      const tab = await pickHoleTab();
      if (tab) await api.tabs.sendMessage(tab.id, { type: 'cq:toggle-panel' }).catch(() => null);
    }
  } catch (e) {
    console.warn('[CoolPills] command failed', e);
  }
});

api.action.onClicked.addListener(() => api.runtime.openOptionsPage());

api.runtime.onInstalled.addListener(async () => {
  const s = await api.storage.local.get(SETTINGS_KEY);
  if (!s[SETTINGS_KEY]) await api.storage.local.set({ [SETTINGS_KEY]: {} }); // content scripts normalize defaults
});
