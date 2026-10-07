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

// ── auto-queue lock (only one Coolhole tab drains Q+ at a time) ─────
let lock = { tabId: null, until: 0 };

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return;
  (async () => {
    switch (msg.type) {
      case 'cq:queue':
        return relayToHole('cq:queue', msg.payload);
      case 'cq:unqueue':
        return relayToHole('cq:unqueue', msg.payload);
      case 'cq:work': {
        const s = await getSettings();
        return relayToHole('cq:work', {}, { focus: s.autoFocus !== false });
      }
      case 'cq:fetch-meta':
        return fetchMeta(msg.url);
      case 'cq:resolve-x-video':
        return resolveXVideo(msg.postUrl);
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
