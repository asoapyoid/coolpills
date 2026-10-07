/* Cool Pills — storage.js
 * chrome.storage.local wrappers, settings, account-scoped keys, shared helpers.
 * Loaded in every content script and the options page (global namespace: self.CQ).
 */
(() => {
  'use strict';
  const CQ = (self.CQ = self.CQ || {});
  if (CQ.store) return;

  const api = typeof browser !== 'undefined' && browser.runtime ? browser : chrome;
  CQ.api = api;

  const KEYS = Object.freeze({
    settings: 'cq_settings',
    siteTheme: 'cq_site_theme',
    v2Phase: 'cq_v2_phase',
    workCd: 'cq_work_cd',
    snap: 'cq_queue_snap',
    roomLimit: 'cq_room_limit',
    pos: 'cq_float_pos',
    gold: 'cq_gold_current',
    pending: 'cq_pending',
    history: 'cq_history',
    pins: 'cq_pins',
  });
  CQ.KEYS = KEYS;
  CQ.DEFAULT_ROOM_LIMIT = 3;

  const alive = () => {
    try {
      return !!(api.runtime && api.runtime.id);
    } catch (_) {
      return false;
    }
  };
  CQ.alive = alive;

  // ── storage ──────────────────────────────────────────────────────
  const watchers = new Set();
  let listening = false;
  function ensureListener() {
    if (listening || !alive()) return;
    listening = true;
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const [key, ch] of Object.entries(changes)) {
        watchers.forEach((w) => {
          try {
            if (w.test(key)) w.cb(ch.newValue, ch.oldValue, key);
          } catch (e) {
            console.warn('[CoolPills] watcher error', e);
          }
        });
      }
    });
  }

  CQ.store = {
    async get(key, fallback = null) {
      if (!alive()) return fallback;
      try {
        const r = await api.storage.local.get(key);
        return r && key in r && r[key] !== undefined ? r[key] : fallback;
      } catch (_) {
        return fallback;
      }
    },
    async set(key, value) {
      if (!alive()) return false;
      try {
        await api.storage.local.set({ [key]: value });
        return true;
      } catch (e) {
        console.warn('[CoolPills] set failed', key, e);
        return false;
      }
    },
    async remove(key) {
      if (!alive()) return;
      try {
        await api.storage.local.remove(key);
      } catch (_) {
        /* ignore */
      }
    },
    async all() {
      if (!alive()) return {};
      try {
        return (await api.storage.local.get(null)) || {};
      } catch (_) {
        return {};
      }
    },
    /** watch(key | predicate, cb(newValue, oldValue, key)) → unwatch() */
    watch(keyOrPred, cb) {
      ensureListener();
      const test = typeof keyOrPred === 'function' ? keyOrPred : (k) => k === keyOrPred;
      const w = { test, cb };
      watchers.add(w);
      return () => watchers.delete(w);
    },
  };

  // ── settings ─────────────────────────────────────────────────────
  CQ.DEFAULTS = Object.freeze({
    theme: 'default', // default | steam | cobra (Battle.net/WC2 is Match-only)
    uiMode: 'auto', // options page: auto | light | dark
    matchCoolholeTheme: false,
    holeOpacity: 0.35,
    ytOpacity: 0.38, // pill opacity on video sites
    grayButtons: true,
    cpMode: 'work', // work | qplus | schedule
    unAfk: false,
    autoFocus: true,
    autoQueue: true,
    openNewCoolholeTab: true,
    qPlusEnabled: true,
    collapsed: false,
    maxQueued: CQ.DEFAULT_ROOM_LIMIT,
    forceIgnoreLimit: false,
    goldChatHist: true,
    disableCinemaIdleHide: false,
    genericEnabled: true,
    keyboardShortcutsEnabled: true,
    keyboardShortcuts: {},
    disabledSites: [],
  });

  const MANUAL_THEMES = ['default', 'steam', 'cobra'];
  const clamp = (n, lo, hi, d) => {
    n = Number(n);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };

  function normalizeSettings(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const s = { ...CQ.DEFAULTS, ...r };
    // Legacy userscript keys
    if (r.cpMode === undefined) {
      if (r.cpToSchedule === true) s.cpMode = 'schedule';
      else if (r.queueToQPlus === true) s.cpMode = 'qplus';
      else s.cpMode = 'work';
    }
    if (r.qPlusEnabled === undefined && r.qPlus === false) s.qPlusEnabled = false;
    if (!MANUAL_THEMES.includes(s.theme)) s.theme = 'default';
    if (!['work', 'qplus', 'schedule'].includes(s.cpMode)) s.cpMode = 'work';
    if (!['auto', 'light', 'dark'].includes(s.uiMode)) s.uiMode = 'auto';
    s.holeOpacity = clamp(s.holeOpacity, 0, 1, 0.35);
    s.ytOpacity = clamp(s.ytOpacity, 0.1, 1, 0.38);
    s.maxQueued = Math.floor(clamp(s.maxQueued, 1, 99, CQ.DEFAULT_ROOM_LIMIT));
    s.disabledSites = Array.isArray(s.disabledSites) ? s.disabledSites.map(String) : [];
    s.keyboardShortcutsEnabled = s.keyboardShortcutsEnabled !== false;
    s.keyboardShortcuts = s.keyboardShortcuts && typeof s.keyboardShortcuts === 'object' && !Array.isArray(s.keyboardShortcuts)
      ? Object.fromEntries(Object.entries(s.keyboardShortcuts)
        .filter(([name, shortcut]) => ['queue-current', 'work', 'toggle-panel'].includes(name) && typeof shortcut === 'string')
        .map(([name, shortcut]) => [name, shortcut.slice(0, 40)]))
      : {};
    ['matchCoolholeTheme', 'grayButtons', 'unAfk', 'autoFocus', 'autoQueue', 'openNewCoolholeTab', 'qPlusEnabled',
      'collapsed', 'forceIgnoreLimit', 'goldChatHist', 'disableCinemaIdleHide', 'genericEnabled',
    ].forEach((k) => (s[k] = s[k] === true));
    return s;
  }
  CQ.normalizeSettings = normalizeSettings;

  const settingListeners = new Set();
  const fireSettings = () =>
    settingListeners.forEach((fn) => {
      try {
        fn(CQ.settings.cur);
      } catch (e) {
        console.warn('[CoolPills] settings listener', e);
      }
    });

  CQ.settings = {
    cur: normalizeSettings(null),
    ready: null,
    async load() {
      this.cur = normalizeSettings(await CQ.store.get(KEYS.settings, null));
      return this.cur;
    },
    async save(patch) {
      this.cur = normalizeSettings({ ...this.cur, ...patch });
      await CQ.store.set(KEYS.settings, this.cur);
      fireSettings();
      return this.cur;
    },
    onChange(fn) {
      settingListeners.add(fn);
      return () => settingListeners.delete(fn);
    },
  };
  CQ.settings.ready = CQ.settings.load();
  CQ.store.watch(KEYS.settings, (nv) => {
    CQ.settings.cur = normalizeSettings(nv);
    fireSettings();
  });

  // ── account scoping ──────────────────────────────────────────────
  /** cq_pending_${username} etc. */
  CQ.accountSuffix = (name) => {
    const n = String(name || '').trim();
    if (!n || /^guest/i.test(n) || /^anon/i.test(n)) return '__guest';
    return '_' + n.toLowerCase().replace(/[^\w.-]+/g, '_').slice(0, 48);
  };

  // ── shared helpers ───────────────────────────────────────────────
  const BAD_TITLES = /^(shared\s*link|youtube|video|null|undefined|\s*)$/i;
  CQ.cleanTitle = (value) => {
    if (value == null) return null;
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (!text || BAD_TITLES.test(text)) return null;
    return text.replace(/\s*[-|–]\s*YouTube\s*$/i, '').trim() || null;
  };

  CQ.isYoutubeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id);

  CQ.ytIdFromUrl = (url) => {
    const m = String(url || '').match(
      /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
    );
    return m ? m[1] : null;
  };

  /** Stable key used to dedupe / compare media across tabs ("is this already queued?") */
  CQ.mediaKey = (idOrUrl) => {
    const s = String(idOrUrl || '').trim();
    const yt = CQ.ytIdFromUrl(s) || (CQ.isYoutubeId(s) ? s : null);
    if (yt) return 'yt:' + yt;
    try {
      if (/^https?:\/\//i.test(s)) {
        const u = new URL(s);
        return 'url:' + u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '');
      }
    } catch (_) {
      /* ignore */
    }
    return 'id:' + s;
  };

  CQ.formatDuration = (sec) => {
    if (sec == null || !Number.isFinite(Number(sec)) || sec < 0) return '';
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h > 0
      ? h + ':' + String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0')
      : m + ':' + String(r).padStart(2, '0');
  };

  CQ.normalizeMediaLink = (raw) => {
    let url = String(raw || '').trim();
    if (!url) return '';
    const markup = url.match(/(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (markup) url = markup[1].trim();
    const bare = url.match(/https?:\/\/[^\s"'<>]+/i);
    if (bare) url = bare[0];
    url = url.replace(/[),.;\]]+$/g, '');
    if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|\?|#)/i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  };

  CQ.smartTitleFromUrl = (url) => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if (/coolhost\.ca$/i.test(host)) return 'Raw Video';
      const last = u.pathname.split('/').filter(Boolean).pop();
      if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last).slice(0, 80);
      const t = host + u.pathname.replace(/\/+$/, '');
      return t.length > 72 ? t.slice(0, 69) + '…' : t;
    } catch (_) {
      return String(url || '').replace(/^https?:\/\//i, '').slice(0, 72) || 'Link';
    }
  };

  /** Parse a pasted/queued link → { videoId, mediaUrl, title } (videoId = YT id or full URL) */
  CQ.parseLink = (raw) => {
    const url = CQ.normalizeMediaLink(raw);
    if (!url || !/^https?:\/\//i.test(url)) return null;
    const yt = CQ.ytIdFromUrl(url);
    if (yt) return { videoId: yt, mediaUrl: 'https://www.youtube.com/watch?v=' + yt, title: null };
    return { videoId: url, mediaUrl: url, title: CQ.smartTitleFromUrl(url) };
  };

  CQ.debounce = (fn, ms) => {
    let t = 0;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  /** Safe runtime message (returns null if the extension was reloaded / no receiver) */
  CQ.send = async (msg) => {
    if (!alive()) return null;
    try {
      return await api.runtime.sendMessage(msg);
    } catch (_) {
      return null;
    }
  };
})();
