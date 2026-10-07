/* Cool Pills — coolhole.js  (coolhole.org / new.coolhole.org only)
 * Floating Hist / Q+ UI, account-scoped storage, queueing into the room, auto-queue watcher,
 * Work, Gold Collector, schedule + +Link popovers, theme detection (Match Coolhole).
 */
(async () => {
  'use strict';
  const CQ = self.CQ;
  if (!CQ || CQ.__hole) return;
  CQ.__hole = true;
  const { store, KEYS, api, ui } = CQ;
  await CQ.settings.ready;
  await ui.themeReady;

  const el = ui.el;
  const $ = (s, r = document) => r.querySelector(s);
  const cfg = () => CQ.settings.cur;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const fmt = (t, title) => t.replaceAll('{title}', title || 'Unknown video');
  const MAX_PENDING = 40;
  const MAX_HISTORY = 30;
  const MAX_PINS = 40;
  const toast = (msg, kind, opts) => ui.toast(msg, kind, opts);

  const SUCCESS = [
    'Queued: {title}', 'Dropped "{title}" at the end of the line', 'Into the hole: {title}',
    'Locked and loaded: {title}', 'Added to the pile: {title}', 'Queue fed. "{title}" is in.',
    'Yoink — "{title}" is yours now', 'Slid "{title}" onto the runway', 'The hole accepts "{title}"',
    'Stashed "{title}" for later', 'One more for the road: {title}', 'Coolhole ate "{title}"',
  ];
  const FAIL = [
    'Could not auto-queue — open the Add panel and try again.', 'Queue miss. Open Library / Add and retry.',
    'The hole spat it back out. Try the Add panel.', 'Filters shrugged. Try Add manually.',
  ];
  const Q_ADDED = [
    'Parked in Q+ — next free slot is yours', 'Holding in Q+ until the hole has room',
    'Q+ caught it — auto-queues when a slot opens', 'Stashed in Q+ (top of the list goes in first)',
  ];
  const Q_POSTED = [
    'Q+ released "{title}" into the hole', 'From the waiting list: {title}',
    'Slot freed — "{title}" is live in queue', 'Auto-queue landed: {title}',
  ];
  const Q_FINAL = [
    'Q+ is clear — last one is in the hole', 'Waiting list emptied. "{title}" closed it out',
    'Final Q+ drop: {title}. Buffer is empty', 'Q+ went dry after "{title}". Nice run',
  ];
  const FORCE_MSG = "Can't Force — you're at your Max Queued limit. Enable “Force ignores limit” or free a slot.";
  const MAX_MSG = 'Your slots in the hole are full — wait for one of yours to play, then try again.';

  // ══ state ════════════════════════════════════════════════════════
  const S = {
    bridge: { client: null, current: null },
    account: null,
    loggedOut: false,
    loginPending: false,
    switchUntil: 0,
    bindToken: 0,
    pending: [],
    history: [],
    pins: [],
    roomLimit: CQ.DEFAULT_ROOM_LIMIT,
    tab: 'hist',
    query: '',
    autoBusy: false,
    lastQueued: { id: null, at: 0 },
    lastAutoAt: 0,
  };
  let floatRoot = null;

  async function bg(msg) {
    return CQ.send(msg);
  }

  // ══ MAIN-world bridge ════════════════════════════════════════════
  const chatWaiters = new Map();
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== 'cq-bridge') return;
    if (d.type === 'state') {
      S.bridge = d.state || S.bridge;
      onBridgeState();
    } else if (d.type === 'chat-result' && chatWaiters.has(d.id)) {
      chatWaiters.get(d.id)(!!d.ok);
      chatWaiters.delete(d.id);
    }
  });
  const askBridge = () => window.postMessage({ source: 'cq-ext', type: 'request-state' }, '*');
  function sendChatText(text) {
    const msg = String(text || '').replace(/\s+/g, ' ').trim();
    if (!msg) return Promise.resolve(false);
    const id = 'c' + Date.now() + Math.random().toString(36).slice(2, 6);
    return new Promise((resolve) => {
      chatWaiters.set(id, resolve);
      window.postMessage({ source: 'cq-ext', type: 'chat', id, msg }, '*');
      setTimeout(() => { if (chatWaiters.delete(id)) resolve(false); }, 1500);
    });
  }

  // ══ account scope ════════════════════════════════════════════════
  const isGuest = (n) => !n || /^guest/i.test(n) || /^anon/i.test(n);
  const sfx = () => CQ.accountSuffix(S.account);
  const K = (base) => base + sfx();
  const loggedIn = () => !S.loggedOut && !!S.account && !isGuest(S.account);

  function getMyName() {
    const c = S.bridge.client;
    if (c) {
      if (c.logged_in === false || c.guest === true) return null;
      const n = String(c.name || '').trim();
      if (n && !isGuest(n)) return n;
      if (c.rank != null && Number(c.rank) < 1) return null;
    }
    try {
      const bar = document.getElementById('login-bar');
      if (bar && !bar.classList.contains('hidden') && bar.offsetParent !== null) {
        const out = document.getElementById('btn-logout');
        if (!out || out.offsetParent === null || out.disabled) return null;
      }
    } catch (_) { /* ignore */ }
    for (const sel of ['#welcome #username', '#welcome .username', '#username', '.user-dropdown .username', '#chatheader .username', '.user-name', '[data-username]']) {
      const n = $(sel);
      if (!n) continue;
      const t = (n.textContent || '').trim() || n.getAttribute('data-username') || '';
      if (t && !isGuest(t)) return t;
    }
    return null;
  }

  async function bindAccount(name) {
    const token = ++S.bindToken;
    const n = (name || '').trim();
    if (!n || isGuest(n)) {
      S.account = null;
      S.pending = []; S.history = []; S.pins = [];
    } else {
      S.account = n;
      const [p, h, pi] = await Promise.all([
        store.get(K(KEYS.pending), []), store.get(K(KEYS.history), []), store.get(K(KEYS.pins), []),
      ]);
      if (token !== S.bindToken) return;
      S.pending = Array.isArray(p) ? p : [];
      S.history = Array.isArray(h) ? h : [];
      S.pins = Array.isArray(pi) ? pi : [];
    }
    refreshUI();
    publishSnapshot();
  }

  async function refreshAccountScope() {
    const next = getMyName();
    const prev = S.account;
    if (S.loggedOut) {
      if (S.loginPending && next && !isGuest(next)) {
        S.loggedOut = false; S.loginPending = false;
        await bindAccount(next);
        S.switchUntil = Date.now() + 4500;
        onLoginRestored(next);
        return;
      }
      if (!next && S.account) await bindAccount(null);
      return;
    }
    if (prev === (next || null)) return;
    const wasIn = !isGuest(prev);
    const nowIn = !isGuest(next);
    await bindAccount(nowIn ? next : null);
    S.switchUntil = Date.now() + 4500;
    if (wasIn && nowIn && prev.toLowerCase() !== next.toLowerCase()) {
      toast(`Q+ is now following ${next} (was ${prev})`, 'account');
    } else if (wasIn && !nowIn) {
      S.loggedOut = true;
      toast('Logged out — Q+ looks empty until you sign in', 'account');
    } else if (!wasIn && nowIn) onLoginRestored(next);
  }
  function onLoginRestored(name) {
    toast('Q+ following ' + (name || 'account'), 'account');
    startGold();
    setTimeout(scheduleAutoCheck, 4600);
  }
  function forceLogoutScope() {
    S.loggedOut = true; S.loginPending = false;
    bindAccount(null);
    S.switchUntil = Date.now() + 4500;
    toast('Logged out — Q+ looks empty until you sign in', 'account');
    [300, 1000, 2500].forEach((ms) => setTimeout(refreshAccountScope, ms));
  }
  function noteLoginAttempt() {
    S.loginPending = true;
    [300, 1200, 2500].forEach((ms) => setTimeout(refreshAccountScope, ms));
  }
  function onBridgeState() {
    refreshAccountScope();
    noteGoldMedia();
  }

  // ── persisted lists (write-through cache) ──
  const savePending = () => {
    if (!loggedIn()) return;
    S.pending = S.pending.slice(0, MAX_PENDING);
    store.set(K(KEYS.pending), S.pending);
    publishSnapshot();
  };
  const saveHistory = () => loggedIn() && store.set(K(KEYS.history), S.history.slice(0, MAX_HISTORY));
  const savePins = () => loggedIn() && store.set(K(KEYS.pins), S.pins.slice(0, MAX_PINS));

  // cross-tab: another Coolhole tab changed this account's lists
  store.watch(
    (key) => !!S.account && [KEYS.pending, KEYS.history, KEYS.pins].some((b) => key === K(b)),
    (nv, _ov, key) => {
      const arr = Array.isArray(nv) ? nv : [];
      if (key === K(KEYS.pending)) {
        if (JSON.stringify(arr) === JSON.stringify(S.pending)) return;
        S.pending = arr;
        scheduleAutoCheck();
      } else if (key === K(KEYS.history)) S.history = arr;
      else S.pins = arr;
      renderIfOpen();
      updateBadge();
    }
  );
  store.watch(KEYS.roomLimit, (nv) => { if (Number(nv) >= 2) { S.roomLimit = Math.floor(nv); updateSlots(); } });

  // ══ queue limits ═════════════════════════════════════════════════
  const getRoomLimit = () => S.roomLimit;
  const getMyLimit = () => Math.min(cfg().maxQueued, getRoomLimit());
  const setRoomLimit = (n) => {
    const v = Math.floor(Number(n));
    if (!(v >= 2)) return;
    S.roomLimit = v;
    store.set(KEYS.roomLimit, v);
  };
  const isQPlusOn = () => cfg().qPlusEnabled;
  const isAuto = () => cfg().autoQueue;

  const normUser = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  function queueRows() {
    const q = $('#queue');
    if (!q) return [];
    let rows = q.querySelectorAll(':scope > li');
    if (!rows.length) rows = q.querySelectorAll('li, .queue_entry, .qe');
    return Array.from(rows);
  }
  function getMyQueuedCount() {
    const me = normUser(getMyName());
    if (!me) return 0;
    let n = 0;
    queueRows().forEach((li) => {
      const who =
        (li.querySelector('.q-user') || li.querySelector('.queue_user, .qe-user') || {}).textContent ||
        li.getAttribute('data-user') || li.getAttribute('data-username') || '';
      if (normUser(who) === me) n += 1;
    });
    return n;
  }
  const rowKeys = (li) => {
    const keys = [];
    li.querySelectorAll('a[href]').forEach((a) => keys.push(CQ.mediaKey(a.getAttribute('href') || a.href || '')));
    ['data-url', 'data-media', 'data-id'].forEach((at) => { const v = li.getAttribute(at); if (v) keys.push(CQ.mediaKey(v)); });
    return keys.filter((k) => k && k !== 'id:');
  };
  const roomKeys = () => { const s = new Set(); queueRows().forEach((li) => rowKeys(li).forEach((k) => s.add(k))); return s; };
  const inRoom = (idOrUrl) => roomKeys().has(CQ.mediaKey(idOrUrl));
  const inPending = (idOrUrl) => { const k = CQ.mediaKey(idOrUrl); return S.pending.some((x) => CQ.mediaKey(x.mediaUrl || x.videoId) === k); };

  function publishSnapshot() {
    try {
      store.set(KEYS.snap, {
        room: Array.from(roomKeys()),
        pending: S.pending.map((x) => CQ.mediaKey(x.mediaUrl || x.videoId)),
        at: Date.now(),
      });
    } catch (_) { /* ignore */ }
  }

  function tryRemoveFromRoom(idOrUrl) {
    const key = CQ.mediaKey(idOrUrl);
    for (const li of queueRows()) {
      if (!rowKeys(li).includes(key)) continue;
      const del =
        li.querySelector('.qbutton.qdelete, button.qdelete, .qdelete') ||
        li.querySelector('[title*="Delete" i], [title*="Remove" i]') ||
        li.querySelector('button.close, .btn-close');
      if (del) { del.click(); return true; }
    }
    return false;
  }
  function handleUnqueue(req) {
    const id = req.url || req.videoId;
    if (!id) return;
    const parsed = CQ.parseLink(id) || { videoId: String(id), mediaUrl: String(id) };
    let p = false;
    if (inPending(parsed.mediaUrl)) {
      S.pending = S.pending.filter((x) => CQ.mediaKey(x.mediaUrl || x.videoId) !== CQ.mediaKey(parsed.mediaUrl));
      savePending();
      p = true;
    }
    const r = tryRemoveFromRoom(parsed.mediaUrl);
    publishSnapshot(); renderIfOpen(); updateBadge();
    if (p || r) toast(r && p ? 'Removed from queue + Q+' : r ? 'Removed from room queue' : 'Removed from Q+', p ? 'qplus' : 'queue');
    else toast('Could not remove (not found or no delete control)', 'error');
  }

  // ── error text / limit learning ──
  function recentErrorText() {
    const chunks = [];
    ['#messagebuffer .server-whisper', '#messagebuffer .server-msg', '#messagebuffer .action', '.alert-danger', '.alert-warning', '#qfail', '#queuefail', '.queue-error']
      .forEach((sel) => document.querySelectorAll(sel).forEach((n) => { const t = n.textContent.trim(); if (t) chunks.push(t); }));
    const buf = $('#messagebuffer');
    if (buf) Array.from(buf.querySelectorAll('div, span, p, li')).slice(-15).forEach((n) => { const t = n.textContent.trim(); if (t) chunks.push(t); });
    return chunks.join('\n');
  }
  const isMaxErr = (t) =>
    !!t && (/already have \d+\s+items?\s+queued/i.test(t) || /wait for one to play/i.test(t) ||
      (/limit\s*\d+/i.test(t) && /queued/i.test(t)) || /queue(?:d)?\s*(?:is\s*)?(?:full|limit)/i.test(t) ||
      /too many (videos?|items?)/i.test(t));
  const learnLimit = (t) => {
    const m = String(t || '').match(/already have (\d+)\s+items?\s+queued/i);
    if (m && +m[1] >= 2) setRoomLimit(+m[1]);
  };

  // ── DOM queue helpers ──
  const HOST_NEW = location.hostname === 'new.coolhole.org';
  const selectors = () =>
    HOST_NEW || $('#queue-url')
      ? { mediaUrl: '#queue-url', queueEnd: '#btn-queue', expandBtn: null, expandTarget: null }
      : { mediaUrl: '#mediaurl', queueEnd: '#queue_end', expandBtn: '#showmediaurl', expandTarget: '#addfromurl' };
  async function ensurePanelOpen(sel) {
    if (!sel.expandTarget) return;
    const p = $(sel.expandTarget);
    if (p && (p.classList.contains('in') || p.classList.contains('show'))) return;
    if (sel.expandBtn) { const b = $(sel.expandBtn); if (b) b.click(); await sleep(250); }
    if (p) { p.classList.add('in', 'show'); p.style.display = 'block'; p.style.height = 'auto'; }
  }
  function setNativeInput(input, value) {
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (d && d.set) d.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function waitFor(selector, ms = 12000) {
    return new Promise((resolve, reject) => {
      const f = $(selector);
      if (f) return resolve(f);
      const obs = new MutationObserver(() => {
        const x = $(selector);
        if (x) { obs.disconnect(); clearTimeout(t); resolve(x); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      const t = setTimeout(() => { obs.disconnect(); reject(new Error('timed out waiting for ' + selector)); }, ms);
    });
  }
  async function roomAdd(mediaUrl) {
    const sel = selectors();
    await ensurePanelOpen(sel);
    const input = await waitFor(sel.mediaUrl);
    const btn = await waitFor(sel.queueEnd);
    if (btn.disabled) {
      await sleep(250);
      const t = recentErrorText();
      if (isMaxErr(t)) { learnLimit(t); return 'max'; }
      throw new Error('Queue button is disabled');
    }
    const before = recentErrorText();
    setNativeInput(input, mediaUrl);
    await sleep(80);
    btn.click();
    await sleep(700);
    const after = recentErrorText();
    const fresh = after.length > before.length ? after.slice(before.length) : after;
    if (isMaxErr(fresh) || isMaxErr(after)) { learnLimit(fresh || after); return 'max'; }
    return 'ok';
  }

  // ══ list operations ══════════════════════════════════════════════
  const durLabel = (item) => {
    const raw = item.durationLabel != null ? String(item.durationLabel).trim() : '';
    if (raw && raw !== 'undefined' && raw !== 'null') return raw;
    return item.duration != null ? CQ.formatDuration(item.duration) : '';
  };
  function normItem(raw) {
    const parsed = raw.videoId && raw.mediaUrl
      ? { videoId: raw.videoId, mediaUrl: raw.mediaUrl }
      : CQ.parseLink(raw.url || raw.mediaUrl || raw.videoId);
    if (!parsed) return null;
    let label = raw.durationLabel || null;
    let dur = raw.duration != null && Number.isFinite(Number(raw.duration)) ? Number(raw.duration) : null;
    if (/^shrt$/i.test(String(label || ''))) { label = 'SHRT'; dur = null; }
    else if (!label && dur != null) label = CQ.formatDuration(dur);
    return {
      videoId: String(parsed.videoId),
      mediaUrl: parsed.mediaUrl,
      title: CQ.cleanTitle(raw.title) || null,
      duration: dur,
      durationLabel: label,
      thumbnail: raw.thumbnail || null,
    };
  }
  function addToPending(item) {
    if (!loggedIn()) return false;
    if (S.pending.some((x) => x.videoId === item.videoId)) return 'in_qplus';
    if (inRoom(item.mediaUrl)) return 'in_room';
    S.pending.push({ ...item, addedAt: Date.now() });
    savePending();
    updateBadge();
    return true;
  }
  const removePending = (videoId) => { S.pending = S.pending.filter((x) => x.videoId !== videoId); savePending(); updateBadge(); };
  function promoteTop(videoId) {
    const i = S.pending.findIndex((x) => x.videoId === videoId);
    if (i < 0) return false;
    if (i > 0) { const [it] = S.pending.splice(i, 1); S.pending.unshift(it); savePending(); renderIfOpen(); }
    return true;
  }
  function setSchedule(videoId, at) {
    const it = S.pending.find((x) => x.videoId === videoId);
    if (!it) return false;
    if (at == null) delete it.scheduledAt; else it.scheduledAt = Number(at);
    savePending(); updateBadge(); armScheduleTimer(); renderIfOpen();
    return true;
  }
  function addToHistory(item) {
    S.history = S.history.filter((x) => x.videoId !== item.videoId);
    S.history.unshift({
      videoId: item.videoId, mediaUrl: item.mediaUrl, title: item.title, duration: item.duration,
      durationLabel: item.durationLabel, thumbnail: item.thumbnail || null, queuedAt: Date.now(),
    });
    saveHistory();
  }
  const isPinned = (id) => S.pins.some((x) => x.videoId === id);
  function togglePin(item) {
    const i = S.pins.findIndex((x) => x.videoId === item.videoId);
    if (i >= 0) S.pins.splice(i, 1);
    else S.pins.unshift({ videoId: item.videoId, mediaUrl: item.mediaUrl, title: item.title, duration: item.duration, durationLabel: item.durationLabel, pinnedAt: Date.now() });
    savePins();
  }
  const openUrl = (item) => {
    const u = item.mediaUrl || (CQ.isYoutubeId(item.videoId) ? 'https://www.youtube.com/watch?v=' + item.videoId : item.videoId);
    if (u) window.open(u, '_blank', 'noopener,noreferrer');
  };
  const displayTitle = (item) => {
    let t = CQ.cleanTitle(item.title);
    const isYt = CQ.isYoutubeId(String(item.videoId));
    if (!isYt && (!t || t === item.videoId || /^https?:\/\//i.test(t) || t.length > 100)) t = CQ.smartTitleFromUrl(item.mediaUrl || item.videoId);
    return t || (isYt ? item.videoId : 'Untitled');
  };

  /** Fill in a missing title / duration through the background worker */
  async function enrich(item) {
    const needTitle = !item.title || /^(raw video|coolhost)$/i.test(item.title);
    if (!needTitle && item.duration != null) return item;
    const m = await Promise.race([bg({ type: 'cq:fetch-meta', url: item.mediaUrl }), sleep(7000).then(() => null)]);
    if (m) {
      if (m.title && needTitle) item.title = CQ.cleanTitle(m.title) || item.title;
      if (m.duration && item.duration == null && item.durationLabel !== 'SHRT') {
        item.duration = m.duration; item.durationLabel = CQ.formatDuration(m.duration);
      }
      if (m.thumbnail && !item.thumbnail) item.thumbnail = m.thumbnail;
    }
    return item;
  }
  async function enrichPending(videoId) {
    const it = S.pending.find((x) => x.videoId === videoId);
    if (!it) return;
    await enrich(it);
    savePending(); renderIfOpen();
  }

  // ══ queueing (CH / Frc / auto-queue) ═════════════════════════════
  async function queueItem(raw, opts = {}) {
    const item = normItem(raw);
    if (!item) { toast('Could not read that link', 'error'); return; }
    const fromPending = !!opts.fromPending;
    if (!loggedIn()) { toast('Log in on Coolhole to queue', 'account'); return; }
    const now = Date.now();
    if (S.lastQueued.id === item.videoId && now - S.lastQueued.at < 2000) return;
    S.lastQueued = { id: item.videoId, at: now };
    const name = () => displayTitle(item);

    if (inRoom(item.mediaUrl)) {
      if (fromPending) { removePending(item.videoId); renderIfOpen(); }
      toast((fromPending ? 'Already in the room queue — dropped from Q+: ' : 'Already in the room queue: ') + name(), 'error');
      return;
    }

    const overflow = async () => {
      if (!isQPlusOn()) { toast(MAX_MSG, 'error'); return; }
      const r = addToPending(item);
      if (r === 'in_room') toast('Already in the room queue', 'error');
      else if (r === 'in_qplus' || r === false) toast('Already in Q+', 'error');
      else { toast(pick(Q_ADDED), 'qplus'); enrichPending(item.videoId); }
      renderIfOpen();
    };

    // CP "Queue to Q+" / Schedule → straight to the waiting list
    if (!fromPending && opts.forceQPlus) {
      if (!isQPlusOn()) { toast('Q+ is disabled', 'error'); return; }
      const r = addToPending(item);
      if (r === 'in_room') return toast('Already in the room queue', 'error');
      if (r === 'in_qplus' || r === false) return toast('Already in Q+', 'error');
      enrichPending(item.videoId);
      if (opts.scheduledAt != null) {
        setSchedule(item.videoId, opts.scheduledAt);
        toast('Scheduled ' + fmtAt(opts.scheduledAt), 'qplus');
      } else toast(pick(Q_ADDED), 'qplus');
      renderIfOpen();
      return;
    }

    if (getMyQueuedCount() >= getMyLimit()) {
      if (!fromPending) return overflow();
      if (!cfg().forceIgnoreLimit) { toast(FORCE_MSG, 'error'); return; }
    }

    try {
      if (!item.title || item.duration == null) await enrich(item);
      const res = await roomAdd(item.mediaUrl);
      if (res === 'max') { if (!fromPending) await overflow(); return; }
      if (fromPending) removePending(item.videoId);
      addToHistory(item);
      setTimeout(() => { const c = getMyQueuedCount(); if (c > getRoomLimit()) setRoomLimit(c); updateSlots(); publishSnapshot(); }, 450);
      if (fromPending) {
        const gold = Math.random() < 0.1;
        if (!S.pending.length) toast(fmt(pick(Q_FINAL), name()), gold ? 'gold-qplus' : 'qplus-final');
        else toast(fmt(pick(Q_POSTED), name()), gold ? 'gold-qplus' : 'qplus-posted');
      } else {
        const gold = Math.random() < 0.12;
        toast(fmt(pick(SUCCESS), name()), gold ? 'gold' : 'queue');
      }
      renderIfOpen();
    } catch (err) {
      console.error('[CoolPills] queue failed', err);
      const t = String(err && err.message) + '\n' + recentErrorText();
      if (isMaxErr(t)) { learnLimit(t); if (!fromPending) await overflow(); }
      else toast(pick(FAIL), 'error');
    }
  }

  // ══ auto-queue (content-script side; background only arbitrates the lock) ══
  let autoDebounce = 0;
  function scheduleAutoCheck() {
    clearTimeout(autoDebounce);
    autoDebounce = setTimeout(tryAutoQueue, 350);
  }
  async function tryAutoQueue() {
    if (S.autoBusy || !isQPlusOn() || !loggedIn() || Date.now() < S.switchUntil || !S.pending.length) return;
    const now = Date.now();
    const due = S.pending.filter((x) => x.scheduledAt != null && Number(x.scheduledAt) <= now);
    const next = due[0] || (isAuto() ? S.pending.find((x) => x.scheduledAt == null) : null);
    if (!next) return;
    const isDue = next.scheduledAt != null && Number(next.scheduledAt) <= now;
    if (getMyQueuedCount() >= getMyLimit()) {
      if (isDue) { promoteTop(next.videoId); toast('Scheduled ready — waiting for a free slot: ' + displayTitle(next), 'qplus'); }
      return;
    }
    if (now - S.lastAutoAt < 1200) return;
    S.autoBusy = true;
    try {
      const lock = await bg({ type: 'cq:lock', ttl: 4000 });
      if (lock && lock.granted === false) return; // another Coolhole tab is draining Q+
      S.lastAutoAt = Date.now();
      if (isDue) toast('Posting scheduled: ' + displayTitle(next), 'qplus');
      await queueItem(next, { fromPending: true });
    } finally {
      updateSlots();
      setTimeout(() => { S.autoBusy = false; scheduleAutoCheck(); armScheduleTimer(); }, 1600);
    }
  }

  let schedTimer = 0;
  function armScheduleTimer() {
    clearTimeout(schedTimer);
    if (!isQPlusOn() || !loggedIn()) return;
    const now = Date.now();
    let nextAt = null;
    for (const x of S.pending) {
      const t = Number(x.scheduledAt);
      if (!Number.isFinite(t)) continue;
      if (t <= now) return scheduleAutoCheck();
      if (nextAt == null || t < nextAt) nextAt = t;
    }
    if (nextAt == null) return;
    schedTimer = setTimeout(() => {
      S.pending.filter((x) => x.scheduledAt != null && Number(x.scheduledAt) <= Date.now()).forEach((x) => promoteTop(x.videoId));
      scheduleAutoCheck(); armScheduleTimer();
    }, Math.max(250, Math.min(nextAt - now + 50, 2147000000)));
  }

  /** Watch #queue; broadcast when one of OUR slots frees up */
  let lastMine = null;
  function onQueueMutation() {
    updateSlots();
    publishSnapshotSoon();
    const mine = getMyQueuedCount();
    const freed = lastMine != null && mine < lastMine;
    lastMine = mine;
    if (!S.pending.length) return;
    scheduleAutoCheck();
    if ((freed || mine < getMyLimit()) && isQPlusOn()) bg({ type: 'cq:slot-open' });
  }
  const publishSnapshotSoon = CQ.debounce(publishSnapshot, 400);
  (function attachQueueObserver(tries = 0) {
    const q = $('#queue');
    if (!q) { if (tries < 40) setTimeout(() => attachQueueObserver(tries + 1), 1500); return; }
    lastMine = getMyQueuedCount();
    new MutationObserver(onQueueMutation).observe(q, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-user', 'data-uid', 'class'],
    });
    publishSnapshot();
  })();

  // ══ Work ═════════════════════════════════════════════════════════
  const workBtn = () => $('#job-actions button.job-action-work') || $('button.job-action-work') || $('button[title="Earn CP"]');
  const sysTexts = (limit = 8) => {
    const out = [];
    const lines = document.querySelectorAll('#messagebuffer .server-whisper, #messagebuffer .chat-line');
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      const n = lines[i];
      const sys = n.classList.contains('server-whisper') || (n.querySelector('.chat-user') || {}).textContent === 'System';
      if (!sys) continue;
      const t = ((n.querySelector('.chat-text') || n).textContent || '').replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
    return out;
  };
  const workBlocked = (t) =>
    /can[’']?t work|cannot work|sun saps your strength|wait for nightfall|work by day|not allowed to work|unable to work|work failed/i.test(t) ||
    /you are (dead|a ghost|ghost|jailed)/i.test(t);

  async function doWork() {
    const s = cfg();
    if (s.unAfk) {
      try {
        const afk = $('button.job-action-afk') || $('#job-actions button[title*="AFK" i]');
        const me = $('#username');
        if (afk && me && me.classList.contains('user-afk')) { afk.click(); await sleep(200); }
      } catch (_) { /* ignore */ }
    }
    let btn = workBtn();
    for (let i = 0; i < 20 && !btn; i++) { await sleep(250); btn = workBtn(); }
    if (!btn) return toast('Work button not found — are you logged in with a job?', 'error');
    if (btn.disabled || btn.classList.contains('work-cooling')) {
      return toast(`Work is on cooldown (${(btn.textContent || '').replace(/\s+/g, ' ').trim() || 'cooling down'})`, 'error');
    }
    const before = new Set(sysTexts());
    btn.click();
    toast('Work — earning CP', 'queue');
    for (let i = 0; i < 10; i++) {
      await sleep(300);
      const hit = sysTexts().find((m) => !before.has(m) && workBlocked(m));
      if (hit) {
        toast('Work failed — ' + (hit.length > 100 ? hit.slice(0, 97) + '…' : hit), 'error');
        store.set(KEYS.workCd, { ready: true, remainingMs: 0, totalMs: 0, startedAt: Date.now(), ts: Date.now(), blocked: true });
        return;
      }
      const b2 = workBtn();
      if (b2 && (b2.disabled || b2.classList.contains('work-cooling'))) break;
    }
    setTimeout(captureCooldown, 400);
    setTimeout(captureCooldown, 1000);
  }
  const parseCd = (text) => {
    const m = String(text || '').replace(/\s+/g, ' ').match(/(?:(\d+)\s*:\s*)?(\d+)\s*s?\b/i);
    return m ? ((m[1] ? +m[1] : 0) * 60 + (+m[2] || 0)) * 1000 : 0;
  };
  function captureCooldown() {
    const btn = workBtn();
    const cdEl = $('#jcd-work');
    const cooling = btn && (btn.disabled || btn.classList.contains('work-cooling') || (cdEl && /\d/.test(cdEl.textContent || '')));
    if (!cooling) return;
    let ms = 0;
    for (const src of [cdEl && cdEl.textContent, btn.textContent, btn.getAttribute('title')]) { ms = parseCd(src); if (ms > 0) break; }
    if (ms <= 0) ms = 30000;
    store.set(KEYS.workCd, { ready: false, remainingMs: ms, totalMs: ms, startedAt: Date.now(), ts: Date.now() });
  }

  // ══ Gold Collector (.text-lottery chat lines) ════════════════════
  const G = { entries: [], seen: new Set(), mediaKey: null, started: false, armed: false, quietUntil: 0 };
  const goldOn = () => cfg().goldChatHist === true;
  const curTitle = () => (S.bridge.current && S.bridge.current.title) || ($('#currenttitle') || {}).textContent || ($('.queue_active .qe_title') || {}).textContent || '';
  const curKey = () => {
    const c = S.bridge.current;
    if (c && (c.id || c.title)) return (c.id != null ? c.id : '') + '|' + (c.title || '');
    const t = String(curTitle()).trim();
    return t || 'none';
  };
  function persistGold() {
    const key = G.mediaKey || curKey();
    if (!key || key === 'none') return;
    store.set(KEYS.gold, {
      mediaKey: key, mediaTitle: String(curTitle()).trim(), savedAt: Date.now(),
      entries: G.entries.filter((e) => e.mediaKey === key).slice(0, 50),
    });
  }
  async function restoreGold() {
    const key = curKey();
    const raw = await store.get(KEYS.gold, null);
    if (!raw || !key || key === 'none' || raw.mediaKey !== key) return false;
    let changed = false;
    for (const e of raw.entries || []) {
      if (!e || !e.key || !e.text) continue;
      const ex = G.entries.find((x) => x.key === e.key);
      if (ex) { if ((e.count || 1) > (ex.count || 1)) { ex.count = e.count; changed = true; } continue; }
      G.seen.add(e.key); G.entries.push({ ...e, count: Math.max(1, e.count || 1) }); changed = true;
    }
    G.entries.sort((a, b) => (b.at || 0) - (a.at || 0));
    G.mediaKey = key;
    return changed;
  }
  function noteGoldMedia() {
    const key = curKey();
    if (key === G.mediaKey) return false;
    G.quietUntil = Math.max(G.quietUntil, Date.now() + 3000);
    const prev = G.mediaKey;
    if (prev && prev !== 'none') persistGold();
    G.mediaKey = key;
    if (prev == null || prev === 'none' || key === 'none') {
      if (key !== 'none') restoreGold().then((c) => c && renderGold());
      return true;
    }
    if (!G.entries.some((e) => e.mediaKey === key)) store.set(KEYS.gold, { mediaKey: key, mediaTitle: String(curTitle()).trim(), entries: [], savedAt: Date.now() });
    return true;
  }
  function ingestGold(node, fromRescan) {
    if (!goldOn() || !node || node.nodeType !== 1) return;
    noteGoldMedia();
    const list = [];
    if (node.classList && node.classList.contains('text-lottery')) list.push(node);
    node.querySelectorAll && node.querySelectorAll('.text-lottery').forEach((n) => list.push(n));
    let changed = false;
    for (const n of list) {
      const text = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 2) continue;
      const key = text.toLowerCase();
      if (G.seen.has(key)) {
        if (fromRescan) continue;
        const e = G.entries.find((x) => x.key === key);
        if (e) {
          e.count = (e.count || 1) + 1; e.at = Date.now();
          G.entries.splice(G.entries.indexOf(e), 1); G.entries.unshift(e); changed = true;
        }
        continue;
      }
      G.seen.add(key);
      G.entries.unshift({ id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, key, at: Date.now(), mediaKey: G.mediaKey || curKey(), mediaTitle: String(curTitle()).trim() || 'Unknown video', count: 1 });
      if (G.entries.length > 80) { const d = G.entries.pop(); if (d) G.seen.delete(d.key); }
      changed = true;
      if (!fromRescan && G.armed && Date.now() >= G.quietUntil) goldToast(text);
    }
    if (changed) { persistGold(); renderGold(); }
  }
  function goldToast(text) {
    const preview = text.length > 90 ? text.slice(0, 87) + '…' : text;
    toast('★ Gold · click to send — ' + preview, 'gold', {
      ms: 7000,
      onClick: async (t) => {
        t.style.pointerEvents = 'none';
        const ok = await sendChatText(text);
        t.textContent = ok ? '★ Gold sent' : '★ Could not send gold';
        setTimeout(() => t.classList.remove('show'), 2200);
      },
    });
  }
  const rescanGold = () => { const b = $('#messagebuffer'); if (b && goldOn()) ingestGold(b, true); };
  function startGold() {
    if (G.started) return;
    G.started = true;
    restoreGold().then((c) => c && renderGold());
    const attach = () => {
      const buf = $('#messagebuffer');
      if (!buf) return false;
      rescanGold();
      G.quietUntil = Date.now() + 5000;
      G.armed = true;
      new MutationObserver((muts) => {
        if (!goldOn()) return;
        const quiet = Date.now() < G.quietUntil;
        muts.forEach((m) => m.addedNodes && m.addedNodes.forEach((n) => ingestGold(n, quiet)));
      }).observe(buf, { childList: true, subtree: true });
      [1500, 4000].forEach((ms) => setTimeout(rescanGold, ms));
      return true;
    };
    if (!attach()) { let n = 0; const t = setInterval(() => { if (attach() || ++n > 15) clearInterval(t); }, 2000); }
    const watchTitle = () => {
      const t = $('#currenttitle');
      if (!t) return;
      new MutationObserver(() => { if (goldOn() && noteGoldMedia()) renderGold(); }).observe(t, { childList: true, characterData: true, subtree: true });
    };
    watchTitle(); setTimeout(watchTitle, 3000);
  }

  // ══ site-theme detection (Match Coolhole) ════════════════════════
  function detectSiteTheme() {
    try {
      for (const sel of document.querySelectorAll('select')) {
        const opts = Array.from(sel.options || []).map((o) => o.textContent || '').join(' ');
        if (!/cinema|battle\.net|black spring|coolhole v2|default \(coolhole\)|classic/i.test(opts)) continue;
        const l = ((sel.selectedOptions && sel.selectedOptions[0] && sel.selectedOptions[0].textContent) || '').trim().toLowerCase();
        if (/battle\.net|\bwc2\b/.test(l)) return 'wc2';
        if (/cinema/.test(l)) return 'cinema';
        if (/black\s*spring|coolhole\s*v2|\bv2\b/.test(l)) return 'v2';
        if (/classic|default/.test(l)) return 'coolhole';
        if (/steam/.test(l)) return 'steam';
      }
      const link = $('#usertheme') || $('link[href*="/css/themes/"]');
      const href = ((link && link.getAttribute('href')) || '').toLowerCase();
      if (/wc2|battle/.test(href)) return 'wc2';
      if (/cinema/.test(href)) return 'cinema';
      if (/spring|v2/.test(href)) return 'v2';
    } catch (_) { /* ignore */ }
    return 'coolhole';
  }
  function detectPhase() {
    const root = document.documentElement;
    const body = document.body;
    const phaseAttrs = [
      root.getAttribute('data-phase'),
      root.dataset && root.dataset.phase,
      body && body.getAttribute('data-phase'),
      body && body.dataset && body.dataset.phase,
    ].map((value) => String(value || '').toLowerCase());
    if (phaseAttrs.some((value) => value === 'moon' || value === 'moonrise')) return 'moon';
    if (phaseAttrs.includes('night')) return 'night';
    if (phaseAttrs.includes('day')) return 'day';
    const dn = document.getElementById('day-night');
    if (dn) {
      const blob = (dn.className || '') + ' ' + (dn.textContent || '').toLowerCase();
      if (/\bis-moon\b|moonrise|\bmoon\b|full.?moon/i.test(blob)) return 'moon';
      if (/\bis-night\b|\bnight\b/i.test(blob)) return 'night';
      if (/\bis-day\b|\bday\b/i.test(blob)) return 'day';
    }
    const blob = [
      root.className,
      body && body.className,
      root.getAttribute('data-theme'),
      ...phaseAttrs,
      body && body.getAttribute('data-theme'),
    ].join(' ');
    if (/\bmoonrise\b|\bis-moon\b|\bmoon\b|full.?moon/i.test(blob)) return 'moon';
    if (/\bnight\b|nocturnal|after.?dark|\bis-night\b/i.test(blob)) return 'night';
    if (/\bday\b|daytime|sunrise|morning|\bis-day\b/i.test(blob)) return 'day';
    const m = new Date().getMinutes();
    return m >= 50 ? 'moon' : m >= 30 ? 'night' : 'day';
  }
  let phaseElement = null;
  let phaseObserver = null;
  const observePhaseElement = () => {
    const next = $('#day-night');
    if (next === phaseElement) return;
    if (phaseObserver) phaseObserver.disconnect();
    phaseElement = next;
    if (phaseElement) {
      phaseObserver = new MutationObserver(syncSiteThemeSoon);
      phaseObserver.observe(phaseElement, { attributes: true, childList: true, characterData: true, subtree: true });
      syncSiteThemeSoon();
    }
  };
  async function syncSiteTheme() {
    const site = detectSiteTheme();
    const phase = detectPhase();
    if (site !== ui.themeState.siteTheme) { ui.themeState.siteTheme = site; await store.set(KEYS.siteTheme, site); }
    if (phase !== ui.themeState.phase) { ui.themeState.phase = phase; await store.set(KEYS.v2Phase, phase); }
    applyTheme();
  }
  const syncSiteThemeSoon = CQ.debounce(syncSiteTheme, 150);

  // ══ float UI ═════════════════════════════════════════════════════
  const FLOAT_CSS = `
#cq-float{position:fixed;z-index:999999;display:flex;flex-direction:column;align-items:flex-start;
  font-family:var(--cq-font,system-ui,sans-serif);user-select:none;transition:opacity .45s ease}
#cq-float.cq-collapsed #cq-float-row,#cq-float.cq-collapsed #cq-panel,#cq-float.cq-collapsed #cq-gold-box{display:none}
#cq-float-restore{display:none;position:relative;cursor:pointer;padding:4px 9px;font:700 10px/1 var(--cq-font,system-ui);letter-spacing:.04em}
#cq-float.cq-collapsed #cq-float-restore{display:inline-flex;align-items:center}
#cq-restore-badge,#cq-q-badge{position:absolute;top:-7px;right:-7px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;
  background:#e53935;color:#fff;font:700 9px/16px system-ui,sans-serif;text-align:center;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.5);z-index:5}
#cq-restore-badge:empty,#cq-q-badge:empty{display:none}
#cq-float-row{position:relative;display:inline-flex;align-items:center}
#cq-float .cq-drag{position:absolute;left:-22px;top:50%;transform:translateY(-50%);width:18px;height:18px;display:flex;
  align-items:center;justify-content:center;cursor:grab;border-radius:6px;font-size:11px;opacity:0;color:#ddd;
  background:rgba(60,60,60,.55);transition:opacity .18s ease}
#cq-float-row:hover .cq-drag,#cq-float .cq-drag:active{opacity:1}
#cq-float-pill-wrap{position:relative;display:inline-flex}
#cq-float-pill{display:inline-flex;align-items:stretch;overflow:hidden;line-height:1}
#cq-float #cq-float-pill .cq-seg,#cq-float #cq-float-restore{position:relative;overflow:hidden;cursor:pointer;margin:0;
  padding:5px 9px;font:700 var(--cq-holefontsize,12px)/1 var(--cq-font);letter-spacing:var(--cq-holeletterspacing,.04em);text-transform:var(--cq-tt);min-width:2.4em;text-align:center}
#cq-float #cq-float-pill .cq-seg::before{content:'';position:absolute;inset:0;background-image:var(--cq-pattern);background-size:7px 7px;pointer-events:none}
#cq-float #cq-float-pill .cq-seg+.cq-seg{border-left:1px solid rgba(0,0,0,.25)}
/* ── CQ colors: Default / Steam / Cobra / Battle.net (isolated from site CSS) ── */
#cq-float:not(.cq-match-site) button,#cq-float:not(.cq-match-site) input{background-image:none;border:0;box-shadow:none;
  text-shadow:none;font-family:var(--cq-font);filter:none;margin:0;outline:none}
#cq-float:not(.cq-match-site) #cq-float-pill{background:var(--cq-holeshell,var(--cq-shell));box-shadow:var(--cq-holeshadow,var(--cq-shadow));
  border:1px solid var(--cq-holeedge,var(--cq-edge));border-radius:var(--cq-holeradius,var(--cq-radius))}
#cq-float:not(.cq-match-site) #cq-float-pill .cq-seg-hist,#cq-float:not(.cq-match-site) #cq-float-restore{background:var(--cq-holech,var(--cq-idlech));
  color:var(--cq-holechfg,var(--cq-chfg));border-radius:0}
#cq-float:not(.cq-match-site) #cq-float-restore{border-radius:var(--cq-holeradius,var(--cq-radius))}
#cq-float:not(.cq-match-site) #cq-float-pill .cq-seg-q{background:var(--cq-holeidlecp,var(--cq-idlecp));
  color:var(--cq-holeidlecpfg,var(--cq-cpfg));border-radius:0;border:var(--cq-holecphborder,0)}
#cq-float:not(.cq-match-site) #cq-float-pill .cq-seg-hist:hover{background:var(--cq-holechh,var(--cq-chh));color:var(--cq-holechhfg,var(--cq-chhfg));
  box-shadow:var(--cq-holechhsh,none)}
#cq-float:not(.cq-match-site) #cq-float-pill .cq-seg-hist.cq-active{background:var(--cq-holecha,var(--cq-chh));color:var(--cq-holechafg,var(--cq-chhfg));
  box-shadow:var(--cq-holechash,none)}
#cq-float:not(.cq-match-site) #cq-float-pill .cq-seg-q:hover{background:var(--cq-holecph,var(--cq-cph));color:var(--cq-holecphfg,var(--cq-cphfg));
  box-shadow:var(--cq-holecphsh,none)}
#cq-float:not(.cq-match-site) #cq-float-pill .cq-seg-q.cq-active{background:var(--cq-holecpa,var(--cq-cph));color:var(--cq-holecpafg,var(--cq-cphfg));
  box-shadow:var(--cq-holecpash,none)}
/* ── Match Coolhole: pack only tints; site .btn CSS keeps its textures/borders ── */
#cq-float.cq-match-site #cq-float-pill{background:var(--cq-holeshell,var(--cq-shell));box-shadow:var(--cq-holeshadow,var(--cq-shadow));
  border:1px solid var(--cq-holeedge,var(--cq-edge));border-radius:var(--cq-holeradius,var(--cq-radius))}
#cq-float.cq-match-site #cq-float-pill .cq-seg-hist,#cq-float.cq-match-site #cq-float-restore{background-color:var(--cq-holechs,var(--cq-chs));color:var(--cq-holechfg,var(--cq-chfg))}
#cq-float.cq-match-site #cq-float-pill .cq-seg-q{background-color:var(--cq-holecps,var(--cq-cps));color:var(--cq-holecpfg,var(--cq-cpfg));
  border:var(--cq-holecphborder,0)}
#cq-float.cq-match-site #cq-float-pill .cq-seg-hist:hover{background-color:var(--cq-holechh,var(--cq-chh));color:var(--cq-holechhfg,var(--cq-chhfg));
  box-shadow:var(--cq-holechhsh,none)}
#cq-float.cq-match-site #cq-float-pill .cq-seg-hist.cq-active{background-color:var(--cq-holecha,var(--cq-chh));color:var(--cq-holechafg,var(--cq-chhfg));
  box-shadow:var(--cq-holechash,none)}
#cq-float.cq-match-site #cq-float-pill .cq-seg-q:hover{background-color:var(--cq-holecph,var(--cq-cph));color:var(--cq-holecphfg,var(--cq-cphfg));
  box-shadow:var(--cq-holecphsh,none)}
#cq-float.cq-match-site #cq-float-pill .cq-seg-q.cq-active{background-color:var(--cq-holecpa,var(--cq-cph));color:var(--cq-holecpafg,var(--cq-cphfg));
  box-shadow:var(--cq-holecpash,none)}
/* ── panel ── */
#cq-float #cq-panel{display:none;flex-direction:column;width:max(260px,100%);min-width:260px;max-width:320px;margin-top:4px;
  box-sizing:border-box;overflow:hidden;font:12px/1.3 var(--cq-font);background:var(--cq-panel);color:var(--cq-panelfg);
  border:1px solid var(--cq-holepaneledge,var(--cq-edge));border-radius:var(--cq-holepanelradius,var(--cq-rad));
  box-shadow:var(--cq-holepanelshadow,0 8px 24px rgba(0,0,0,.5))}
#cq-float #cq-panel.open{display:flex}
#cq-panel-body{max-height:96px;overflow-y:auto}
.cq-row{display:flex;align-items:center;gap:4px;padding:3px 6px;min-height:24px;box-sizing:border-box;border-bottom:1px solid var(--cq-edge)}
.cq-row:hover{background:rgba(128,128,128,.14)}
.cq-row.cq-next{box-shadow:inset 3px 0 0 currentColor}
.cq-row.cq-pinned{background:rgba(255,193,7,.08)}
.cq-row.cq-dragging{opacity:.45}
.cq-row.cq-drag-over{border-top:2px solid var(--cq-cph)}
.cq-grip{flex-shrink:0;cursor:grab;font-size:11px;opacity:.55}
.cq-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;cursor:pointer}
.cq-title:hover{text-decoration:underline}
.cq-row.cq-next .cq-title{font-weight:700}
.cq-sep{flex-shrink:0;opacity:.35;font-size:11px}
.cq-dur{flex-shrink:0;font:700 10px/1.2 var(--cq-font);font-variant-numeric:tabular-nums;opacity:.85;white-space:nowrap}
.cq-sch-badge{flex-shrink:0;font:700 10px/1.2 var(--cq-font);padding:2px 5px;border-radius:4px;background:var(--cq-cps);color:var(--cq-cpfg);cursor:default}
.cq-act{flex-shrink:0;border:0;border-radius:3px;padding:2px 6px;font:700 10px/1.2 var(--cq-font);cursor:pointer}
.cq-act-pin{background:transparent;color:#ffc107;font-size:12px}
.cq-act-del{background:rgba(128,128,128,.3);color:inherit}
.cq-frc-sch{display:inline-flex;flex-shrink:0;overflow:hidden;border-radius:var(--cq-rad)}
.cq-frc-sch>button{border:0;border-radius:0;padding:2px 7px;font:700 10px/1.2 var(--cq-font);cursor:pointer;text-transform:var(--cq-tt)}
.cq-act-frc,.cq-act-ch{background:var(--cq-chs);color:var(--cq-chfg)}
.cq-act-frc:hover,.cq-act-ch:hover{background:var(--cq-chh);color:var(--cq-chhfg)}
.cq-act-sch{background:var(--cq-cps);color:var(--cq-cpfg)}
.cq-act-sch:hover,.cq-act-sch.cq-sch-on{background:var(--cq-cph);color:var(--cq-cphfg)}
#cq-panel-empty{padding:10px 8px;text-align:center;font-size:11px;opacity:.65}
#cq-panel-footer{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:4px 6px;font-size:11px;background:var(--cq-head);border-top:1px solid var(--cq-edge)}
#cq-panel-footer button{border:0;border-radius:3px;padding:2px 7px;font:700 10px var(--cq-font);cursor:pointer;background:var(--cq-cps);color:var(--cq-cpfg)}
#cq-panel-footer button:hover{background:var(--cq-cph);color:var(--cq-cphfg)}
#cq-panel-footer .cq-search{width:72px;min-width:0;box-sizing:border-box;border-radius:4px;padding:2px 6px;font:11px var(--cq-font);
  border:1px solid var(--cq-edge);background:rgba(0,0,0,.3);color:inherit;transition:width .15s ease}
#cq-panel-footer .cq-search:focus{width:150px;outline:none}
.cq-spacer{flex:1 1 auto}
.cq-slots{font:700 10px/1.2 ui-monospace,Menlo,Consolas,monospace;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.28);white-space:nowrap}
.cq-auto{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:4px;font:700 10px/1.2 var(--cq-font);cursor:pointer;
  background:rgba(0,0,0,.35);opacity:.8;white-space:nowrap}
.cq-auto.cq-auto-on{opacity:1;background:var(--cq-cps);color:var(--cq-cpfg)}
.cq-auto input{margin:0;width:12px;height:12px;accent-color:var(--cq-cph)}
/* ── Gold Collector ── */
#cq-gold-box{display:none;position:absolute;left:0;bottom:100%;margin-bottom:4px;min-width:260px;max-width:320px;padding:4px 6px;
  box-sizing:border-box;border-radius:var(--cq-rad);background:rgba(20,16,6,.92);border:1px solid rgba(232,197,71,.45);
  box-shadow:0 4px 14px rgba(0,0,0,.45);flex-direction:column;max-height:150px;overflow:hidden}
.cq-gold-head{font:700 10px/1.2 system-ui;color:#e8c547;letter-spacing:.04em;margin-bottom:3px}
.cq-gold-empty{font:11px/1.3 system-ui;color:rgba(240,215,123,.55)}
.cq-gold-list{overflow-y:auto;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin}
.cq-gold-row{display:flex;align-items:flex-start;gap:6px;padding:3px 4px;border-radius:4px;border-bottom:1px solid rgba(232,197,71,.12);flex-shrink:0}
.cq-gold-row:hover{background:rgba(232,197,71,.18)}
.cq-gold-text{flex:1;min-width:0;font:700 11px/1.35 system-ui;word-break:break-word;color:#e8c547;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.cq-gold-text.cq-gold-past{color:#a8b0b8}
.cq-gold-count{flex-shrink:0;align-self:center;padding:2px 6px;border-radius:999px;font:700 9px/1.2 system-ui;color:#1a1408;background:linear-gradient(180deg,#f0d77b,#c9a227)}
.cq-gold-send{flex-shrink:0;padding:2px 7px;font:700 10px system-ui;border-radius:4px;border:1px solid rgba(232,197,71,.45);background:rgba(232,197,71,.15);color:#f0d77b;cursor:pointer}
.cq-gold-send:hover{background:rgba(232,197,71,.35);color:#1a1200}
/* ── popovers (+Link / Schedule) ── */
.cq-pop{position:fixed;z-index:1000000;width:230px;box-sizing:border-box;padding:8px;border-radius:var(--cq-rad,8px);
  background:var(--cq-panel);color:var(--cq-panelfg);border:1px solid var(--cq-edge);font:12px/1.3 var(--cq-font);box-shadow:0 8px 24px rgba(0,0,0,.45)}
.cq-pop-head{font-weight:700;margin-bottom:6px}
.cq-pop input{width:100%;box-sizing:border-box;margin-bottom:6px;padding:5px 6px;border-radius:4px;border:1px solid var(--cq-edge);
  background:rgba(0,0,0,.35);color:inherit;color-scheme:dark;font:11px var(--cq-font)}
.cq-pop-row{display:flex;gap:6px}
.cq-pop button{flex:1;border:0;border-radius:4px;padding:4px 10px;font:700 11px var(--cq-font);cursor:pointer;background:var(--cq-cps);color:var(--cq-cpfg)}
.cq-pop button.cq-primary{background:var(--cq-chs);color:var(--cq-chfg)}
.cq-pop .cq-link-row{display:flex;margin-bottom:6px}
.cq-pop .cq-link-row input{margin:0;border-radius:4px 0 0 4px}
.cq-pop .cq-link-row button{flex:0 0 auto;border-radius:0 4px 4px 0}
`;
  ui.injectStyle('cq-theme-pack', ui.themeCss());
  ui.injectStyle('cq-float-css', FLOAT_CSS);

  const SITE_BTN = ['btn', 'btn-default', 'btn-xs'];
  function applySiteClasses(root) {
    const on = cfg().matchCoolholeTheme;
    (root || document).querySelectorAll('#cq-float button, .cq-pop button, .cq-drag').forEach((b) => {
      SITE_BTN.forEach((c) => b.classList.toggle(c, on && !b.classList.contains('cq-act-pin')));
    });
  }

  function applyTheme() {
    const s = cfg();
    const id = ui.themeId(s);
    document.querySelectorAll('#cq-float, .cq-pop, #cq-toast').forEach((n) => {
      n.setAttribute('data-cq-theme', id);
      n.setAttribute('data-cq-phase', ui.themeState.phase);
    });
    if (floatRoot) floatRoot.classList.toggle('cq-match-site', s.matchCoolholeTheme);
    applySiteClasses();
    applyOpacity();
  }

  // ── opacity + Cinema idle-fade (Match ON + Cinema site theme only) ──
  const CINEMA_IDLE_MS = 3000;
  let cinemaT = 0;
  let cinemaHidden = false;
  const isCinemaMatch = () => cfg().matchCoolholeTheme && ui.themeState.siteTheme === 'cinema' && !cfg().disableCinemaIdleHide;
  const panelOpen = () => { const p = $('#cq-panel'); return !!(p && p.classList.contains('open')); };
  function applyOpacity() {
    if (!floatRoot) return;
    const op = cfg().holeOpacity;
    const hot = floatRoot.matches(':hover');
    let v;
    if (hot || panelOpen()) v = 1; // never dim an open list
    else if (isCinemaMatch()) v = cinemaHidden && !panelOpen() ? 0 : panelOpen() ? 1 : op || 1;
    else if (floatRoot.classList.contains('cq-collapsed')) v = Math.max(0, op * 0.6);
    else v = op;
    if (!isCinemaMatch()) cinemaHidden = false;
    floatRoot.style.opacity = String(v);
  }
  function bumpCinema() {
    if (!isCinemaMatch()) return;
    cinemaHidden = false;
    applyOpacity();
    clearTimeout(cinemaT);
    cinemaT = setTimeout(() => {
      if (!isCinemaMatch() || floatRoot.matches(':hover') || panelOpen()) return;
      cinemaHidden = true;
      applyOpacity();
    }, CINEMA_IDLE_MS);
  }

  // ── rendering ──
  const fmtAt = (ts) => { try { return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  const slotsText = () => getMyQueuedCount() + '/' + getRoomLimit();
  function updateSlots() {
    document.querySelectorAll('.cq-slots').forEach((n) => {
      n.textContent = slotsText();
      n.title = 'Your videos in the room queue / room max. Personal Max Queued: ' + cfg().maxQueued;
    });
  }
  function updateBadge() {
    const n = !isQPlusOn() ? 0 : S.pending.length;
    const t = n > 0 ? String(n) : '';
    const b = $('#cq-q-badge');
    const r = $('#cq-restore-badge');
    if (b) b.textContent = t;
    if (r) r.textContent = t;
    updateSlots();
  }
  const renderIfOpen = () => { if (panelOpen()) renderPanel(); updateBadge(); renderGold(); };
  const refreshUI = () => { renderIfOpen(); };

  function histList() {
    const pinIds = new Set(S.pins.map((p) => p.videoId));
    const rest = S.history.filter((x) => !pinIds.has(x.videoId)).map((x) => ({ ...x, pinned: false }));
    const pinRows = S.pins.map((p) => {
      const hit = S.history.find((h) => h.videoId === p.videoId) || {};
      return { ...p, title: hit.title || p.title, duration: hit.duration != null ? hit.duration : p.duration, durationLabel: hit.durationLabel || p.durationLabel, pinned: true };
    });
    let list = pinRows.concat(rest);
    if (S.query) {
      const q = S.query.toLowerCase();
      list = list.filter((x) => displayTitle(x).toLowerCase().includes(q) || String(x.videoId).toLowerCase().includes(q));
    }
    return list;
  }

  function renderPanel() {
    renderBody();
    renderFooter();
    applyTheme();
  }

  function renderBody() {
    const body = $('#cq-panel-body');
    if (!body) return;
    const isHist = S.tab === 'hist';
    const list = !loggedIn() ? [] : isHist ? histList() : S.pending;
    body.replaceChildren();
    if (!list.length) {
      body.append(el('div', null, !loggedIn() ? 'Log in on Coolhole to use Hist / Q+' : isHist ? (S.query ? 'No matches' : 'No history yet — queue something!') : 'Q+ is empty — drag to reorder when it fills', { id: 'cq-panel-empty' }));
      return;
    }
    list.forEach((item, index) => body.append(buildRow(item, index, isHist, body)));
  }

  function buildRow(item, index, isHist, body) {
    const row = el('div', 'cq-row' + (!isHist && index === 0 ? ' cq-next' : '') + (item.pinned ? ' cq-pinned' : ''));
    if (!isHist) {
      row.draggable = true;
      const grip = el('span', 'cq-grip', '⠿', { title: 'Drag to reorder · double-click = send to top' });
      grip.addEventListener('dblclick', (e) => { e.preventDefault(); e.stopPropagation(); if (promoteTop(item.videoId)) toast('Moved to top of Q+', 'qplus'); });
      row.append(grip);
      row.addEventListener('dragstart', (e) => { e.stopPropagation(); row.classList.add('cq-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.videoId); });
      row.addEventListener('dragend', () => { row.classList.remove('cq-dragging'); body.querySelectorAll('.cq-drag-over').forEach((n) => n.classList.remove('cq-drag-over')); });
      row.addEventListener('dragover', (e) => { e.preventDefault(); body.querySelectorAll('.cq-drag-over').forEach((n) => n.classList.remove('cq-drag-over')); row.classList.add('cq-drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('cq-drag-over'));
      row.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation();
        const from = S.pending.findIndex((x) => x.videoId === e.dataTransfer.getData('text/plain'));
        const to = S.pending.findIndex((x) => x.videoId === item.videoId);
        if (from < 0 || to < 0 || from === to) return;
        const [m] = S.pending.splice(from, 1);
        S.pending.splice(to, 0, m);
        savePending(); renderBody(); applyTheme();
      });
    } else {
      const pin = el('button', 'cq-act cq-act-pin', item.pinned ? '★' : '☆', { type: 'button', title: item.pinned ? 'Unpin' : 'Pin' });
      pin.addEventListener('click', (e) => { e.stopPropagation(); togglePin(item); renderBody(); applyTheme(); });
      row.append(pin);
    }

    const title = el('div', 'cq-title', displayTitle(item), { title: 'Open source link' });
    title.addEventListener('click', (e) => { e.stopPropagation(); openUrl(item); });
    row.append(title);

    const dl = durLabel(item);
    if (dl) row.append(el('span', 'cq-sep', '|'), el('span', 'cq-dur', dl, { title: 'Length' }));
    if (!isHist && item.scheduledAt) row.append(el('span', 'cq-sch-badge', 'Sch', { title: 'Queues at ' + fmtAt(item.scheduledAt) }));

    const wrap = el('div', 'cq-frc-sch');
    const sch = el('button', 'cq-act cq-act-sch' + (!isHist && item.scheduledAt ? ' cq-sch-on' : ''), 'Sch', {
      type: 'button',
      title: item.scheduledAt ? 'Scheduled: ' + fmtAt(item.scheduledAt) + ' — click to edit/cancel' : 'Schedule into Q+ for a future time',
    });
    sch.addEventListener('click', (e) => { e.stopPropagation(); openSchedulePopover(sch, item); });
    if (isHist) {
      const ch = el('button', 'cq-act cq-act-ch', 'CH', { type: 'button', title: 'Re-queue / add to Q+' });
      ch.addEventListener('click', (e) => { e.stopPropagation(); queueItem(item); });
      wrap.append(ch, sch);
    } else {
      const lim = getMyLimit();
      const frc = el('button', 'cq-act cq-act-frc', 'Frc', {
        type: 'button',
        title: cfg().forceIgnoreLimit ? 'Force queue now (ignores Max Queued)' : getMyQueuedCount() >= lim ? `At Max Queued (${lim}) — enable “Force ignores limit” or free a slot` : 'Force queue now',
      });
      frc.addEventListener('click', (e) => { e.stopPropagation(); queueItem(item, { fromPending: true }); });
      wrap.append(frc, sch);
    }
    const del = el('button', 'cq-act cq-act-del', '×', { type: 'button', title: 'Remove' });
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isHist) {
        S.history = S.history.filter((x) => x.videoId !== item.videoId);
        saveHistory();
        if (isPinned(item.videoId)) togglePin(item);
      } else removePending(item.videoId);
      renderBody(); applyTheme();
    });
    row.append(wrap, del);
    return row;
  }

  function renderFooter() {
    const footer = $('#cq-panel-footer');
    if (!footer) return;
    const isHist = S.tab === 'hist';
    footer.replaceChildren();
    const clear = el('button', null, 'Clear', { type: 'button' });
    clear.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isHist) { S.history = []; saveHistory(); } else { S.pending = []; savePending(); }
      renderPanel();
    });
    footer.append(clear);
    if (isHist) {
      const search = el('input', 'cq-search', null, { type: 'search', placeholder: 'Search' });
      search.value = S.query;
      search.addEventListener('input', () => { S.query = search.value.trim(); renderBody(); applyTheme(); }); // footer untouched → focus kept
      search.addEventListener('click', (e) => e.stopPropagation());
      search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { S.query = ''; search.value = ''; renderBody(); applyTheme(); } });
      footer.append(search);
    } else {
      const link = el('button', null, '+Link', { type: 'button', title: 'Add Coolhost / YouTube / other media URLs to Q+' });
      link.addEventListener('click', (e) => { e.stopPropagation(); openLinkPopover(link); });
      footer.append(link);
    }
    footer.append(el('span', 'cq-spacer'));
    footer.append(el('span', 'cq-slots', slotsText()));
    const lab = el('label', 'cq-auto' + (isAuto() ? ' cq-auto-on' : ''), null, { title: 'When on, Q+ posts into the room queue as slots free up' });
    const cb = el('input', null, null, { type: 'checkbox' });
    cb.checked = isAuto();
    cb.addEventListener('change', () => { CQ.settings.save({ autoQueue: cb.checked }); lab.classList.toggle('cq-auto-on', cb.checked); if (cb.checked) tryAutoQueue(); });
    lab.append(cb, el('span', null, 'Auto-queue'));
    footer.append(lab);
    updateSlots();
  }

  function renderGold() {
    const box = $('#cq-gold-box');
    if (!box) return;
    if (!(goldOn() && S.tab === 'hist' && panelOpen() && !cfg().collapsed)) { box.style.display = 'none'; box.replaceChildren(); return; }
    noteGoldMedia();
    const key = G.mediaKey || curKey();
    box.style.display = 'flex';
    box.replaceChildren(el('div', 'cq-gold-head', 'Gold Collector'));
    if (!G.entries.length) { box.append(el('div', 'cq-gold-empty', 'No Gold Yet')); return; }
    const list = el('div', 'cq-gold-list');
    G.entries.forEach((e) => {
      const cur = e.mediaKey === key;
      const n = Math.max(1, e.count || 1);
      const row = el('div', 'cq-gold-row');
      const t = el('span', 'cq-gold-text ' + (cur ? 'text-lottery' : 'cq-gold-past'), e.text || '(empty gold)', { title: (e.mediaTitle || 'Unknown video') + (cur ? ' (playing now)' : '') + (n > 1 ? ' · ×' + n : '') });
      const c = el('span', 'cq-gold-count', n > 1 ? '×' + n : '');
      if (n <= 1) c.style.visibility = 'hidden';
      const send = el('button', 'cq-gold-send', 'Send', { type: 'button', title: 'Send in chat' });
      send.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const ok = await sendChatText(e.text);
        send.textContent = ok ? '✓' : '?!';
        setTimeout(() => (send.textContent = 'Send'), 900);
      });
      row.append(t, c, send);
      list.append(row);
    });
    box.append(list);
    applySiteClasses(box);
  }

  function openPanel(tab) {
    S.tab = tab;
    $('#cq-panel').classList.add('open');
    document.querySelectorAll('#cq-float-pill .cq-seg').forEach((b) => b.classList.toggle('cq-active', b.dataset.tab === tab));
    if (tab === 'hist') rescanGold();
    renderPanel();
    renderGold();
    bumpCinema();
  }
  function closePanel() {
    const p = $('#cq-panel');
    if (p) p.classList.remove('open');
    document.querySelectorAll('#cq-float-pill .cq-seg').forEach((b) => b.classList.remove('cq-active'));
    renderGold();
  }

  // ── popovers ──
  const closePops = () => document.querySelectorAll('.cq-pop').forEach((n) => n.remove());
  function placePop(pop, anchor, w = 230, h = 130) {
    document.body.appendChild(pop);
    pop.setAttribute('data-cq-theme', ui.themeId());
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    pop.style.top = (r.bottom + h > innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
    applySiteClasses(pop);
    const onDoc = (e) => { if (pop.contains(e.target) || anchor.contains(e.target)) return; pop.remove(); document.removeEventListener('mousedown', onDoc, true); };
    setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  }
  const toLocal = (ts) => { const d = new Date(ts); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

  function openSchedulePopover(anchor, item) {
    closePops();
    const pop = el('div', 'cq-pop');
    const inp = el('input', null, null, { type: 'datetime-local' });
    const min = Date.now() + 30000;
    inp.min = toLocal(min);
    inp.value = toLocal(item.scheduledAt && item.scheduledAt > Date.now() ? item.scheduledAt : min);
    const go = el('button', 'cq-primary', 'Schedule', { type: 'button' });
    go.addEventListener('click', () => {
      const ts = new Date(inp.value).getTime();
      if (!Number.isFinite(ts) || ts <= Date.now()) return toast("Can't schedule in the past — pick a future time", 'error');
      if (!S.pending.some((x) => x.videoId === item.videoId)) {
        const n = normItem(item);
        if (n) addToPending(n);
      }
      setSchedule(item.videoId, ts);
      toast('Scheduled for ' + fmtAt(ts), 'qplus');
      pop.remove();
    });
    const cancel = el('button', null, item.scheduledAt ? 'Cancel Sch' : 'Close', { type: 'button' });
    cancel.addEventListener('click', () => {
      if (item.scheduledAt) { setSchedule(item.videoId, null); toast('Schedule cleared', 'qplus'); }
      pop.remove();
    });
    pop.append(el('div', 'cq-pop-head', 'Schedule'), inp, el('div', 'cq-pop-row'));
    pop.lastChild.append(go, cancel);
    placePop(pop, anchor, 230, 110);
  }

  function openLinkPopover(anchor) {
    closePops();
    if (!loggedIn()) return toast('Log in on Coolhole to use Q+', 'account');
    if (!isQPlusOn()) return toast('Q+ is disabled', 'error');
    const pop = el('div', 'cq-pop');
    const row = el('div', 'cq-link-row');
    const inp = el('input', null, null, { type: 'text', placeholder: 'Paste media URL(s)…', autocomplete: 'off' });
    const paste = el('button', null, 'Paste', { type: 'button', title: 'Reads your clipboard' });
    paste.addEventListener('click', async () => {
      try { inp.value = await navigator.clipboard.readText(); doAdd(); }
      catch (_) { inp.focus(); toast('Press Ctrl+V', 'queue'); }
    });
    row.append(inp, paste);
    const doAdd = () => {
      const raw = (inp.value || '').trim();
      if (!raw) return toast('Paste a media URL first', 'error');
      // multi-link: one per line, or several http(s) URLs in one paste
      let chunks = raw.split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean);
      if (chunks.length <= 1) {
        const found = raw.match(/https?:\/\/[^\s"'<>]+/gi) || [];
        if (found.length > 1) chunks = found.map((u) => u.replace(/[),.;\]]+$/g, ''));
      }
      let added = 0;
      let skipped = 0;
      for (const c of chunks) {
        const item = normItem({ url: c });
        if (item && addToPending(item) === true) { added++; enrichPending(item.videoId); } else skipped++;
      }
      if (!added) return toast(skipped ? 'Nothing added (already in queue/Q+ or invalid links)' : 'Paste a full media URL', 'error');
      toast(added > 1 ? `Added ${added} to Q+` + (skipped ? ` (${skipped} skipped)` : '') : pick(Q_ADDED), 'qplus');
      pop.remove(); renderIfOpen(); scheduleAutoCheck();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    inp.addEventListener('paste', () => setTimeout(() => (inp.value || '').trim() && doAdd(), 0)); // paste → add
    const add = el('button', 'cq-primary', 'Add', { type: 'button' });
    add.addEventListener('click', doAdd);
    const close = el('button', null, 'Close', { type: 'button' });
    close.addEventListener('click', () => pop.remove());
    const actions = el('div', 'cq-pop-row');
    actions.append(add, close);
    pop.append(el('div', 'cq-pop-head', 'Add link(s) to Q+'), row, actions);
    placePop(pop, anchor, 230, 120);
    setTimeout(() => inp.focus(), 0);
  }

  // ── build float ──
  const posOf = async () => {
    const p = await store.get(KEYS.pos, null);
    return p && typeof p.x === 'number' ? p : { x: Math.max(16, innerWidth - 320), y: Math.max(80, innerHeight - 220) };
  };
  function applyPos(x, y) {
    x = Math.max(4, Math.min(x, innerWidth - 40));
    y = Math.max(4, Math.min(y, innerHeight - 40));
    floatRoot.style.left = x + 'px';
    floatRoot.style.top = y + 'px';
  }
  function setCollapsed(on) {
    CQ.settings.save({ collapsed: !!on });
    applyCollapsed();
  }
  function applyCollapsed() {
    if (!floatRoot) return;
    const on = cfg().collapsed;
    floatRoot.classList.toggle('cq-collapsed', on);
    if (on) closePanel();
    applyOpacity();
    updateBadge();
  }

  async function buildFloat() {
    if ($('#cq-float')) return;
    const root = el('div', null, null, { id: 'cq-float' });
    const row = el('div', null, null, { id: 'cq-float-row' });
    const drag = el('div', 'cq-drag', '⠿', { title: 'Drag to move · double-click to hide' });
    const wrap = el('div', null, null, { id: 'cq-float-pill-wrap' });
    const pill = el('div', null, null, { id: 'cq-float-pill' });
    const hist = el('button', 'cq-seg cq-seg-hist', 'Hist', { type: 'button', 'data-tab': 'hist', title: 'Your previously queued videos' });
    const q = el('button', 'cq-seg cq-seg-q', 'Q+', { type: 'button', 'data-tab': 'q', title: 'Waiting list (auto-queues when a slot opens)' });
    pill.append(hist, q);
    wrap.append(pill, el('span', null, null, { id: 'cq-q-badge' }));
    row.append(drag, wrap);
    const restore = el('button', null, 'Q+', { type: 'button', id: 'cq-float-restore', title: 'Show Hist / Q+' });
    restore.append(el('span', null, null, { id: 'cq-restore-badge' }));
    const gold = el('div', null, null, { id: 'cq-gold-box' });
    const panel = el('div', null, null, { id: 'cq-panel' });
    panel.append(el('div', null, null, { id: 'cq-panel-body' }), el('div', null, null, { id: 'cq-panel-footer' }));
    root.append(gold, row, restore, panel);
    document.body.appendChild(root);
    floatRoot = root;

    const pos = await posOf();
    applyPos(pos.x, pos.y);
    applyCollapsed();
    applyTheme();

    root.addEventListener('mouseenter', () => { cinemaHidden = false; clearTimeout(cinemaT); applyOpacity(); });
    root.addEventListener('mouseleave', () => (isCinemaMatch() ? bumpCinema() : applyOpacity()));
    ['mousemove', 'mousedown'].forEach((ev) => document.addEventListener(ev, () => isCinemaMatch() && bumpCinema(), { passive: true }));

    // drag + double-tap to hide
    let dragging = false; let sx = 0; let sy = 0; let ox = 0; let oy = 0; let moved = false; let lastTap = 0;
    const onMove = (e) => { if (!dragging) return; if (Math.abs(e.clientX - sx) > 3 || Math.abs(e.clientY - sy) > 3) moved = true; applyPos(ox + e.clientX - sx, oy + e.clientY - sy); };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const r = root.getBoundingClientRect();
      store.set(KEYS.pos, { x: r.left, y: r.top });
      if (!moved) { const now = Date.now(); if (now - lastTap < 380) { lastTap = 0; setCollapsed(true); } else lastTap = now; } else lastTap = 0;
    };
    drag.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      const r = root.getBoundingClientRect(); ox = r.left; oy = r.top;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
    restore.addEventListener('click', (e) => { e.stopPropagation(); setCollapsed(false); });
    hist.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.contains('open') && S.tab === 'hist' ? closePanel() : openPanel('hist'); });
    q.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.contains('open') && S.tab === 'q' ? closePanel() : openPanel('q'); });
    document.addEventListener('click', (e) => { if (panel.classList.contains('open') && !root.contains(e.target) && !e.target.closest('.cq-pop')) closePanel(); });
    window.addEventListener('resize', () => { const r = root.getBoundingClientRect(); applyPos(r.left, r.top); }, { passive: true });
    updateBadge();
    startGold();
  }

  // ══ settings reactions ═══════════════════════════════════════════
  let lastGold = cfg().goldChatHist;
  CQ.settings.onChange((s) => {
    applyTheme();
    applyCollapsed();
    if (s.goldChatHist && !lastGold) { startGold(); rescanGold(); }
    lastGold = s.goldChatHist;
    if (panelOpen()) renderPanel();
    renderGold();
    updateBadge();
    armScheduleTimer();
    scheduleAutoCheck();
    bumpCinema();
  });
  ui.onTheme(applyTheme);

  // ══ messages from background ═════════════════════════════════════
  api.runtime.onMessage.addListener((msg, _s, respond) => {
    if (!msg) return;
    switch (msg.type) {
      case 'cq:queue': {
        const p = msg.payload || {};
        queueItem(p, { forceQPlus: p.forceQPlus === true, scheduledAt: p.scheduledAt });
        respond({ ok: true });
        break;
      }
      case 'cq:unqueue': handleUnqueue(msg.payload || {}); respond({ ok: true }); break;
      case 'cq:work': doWork(); respond({ ok: true }); break;
      case 'cq:try-auto': scheduleAutoCheck(); respond({ ok: true }); break;
      case 'cq:toggle-panel': setCollapsed(!cfg().collapsed); respond({ ok: true }); break;
      default: break;
    }
  });

  // ══ hash fallback (opened from another site while Coolhole was closed) ══
  function processHash() {
    const h = location.hash || '';
    if (/(?:^|[&#])cq_work=1(?:&|$)/.test(h)) { clearHash(); doWork(); return; }
    const add = h.match(/cq_add=([^&]+)/);
    if (!add) return;
    const g = (k) => { const m = h.match(new RegExp('[#&]' + k + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : null; };
    clearHash();
    const dur = Number(g('cq_dur'));
    queueItem(
      { url: decodeURIComponent(add[1]), title: g('cq_title'), duration: Number.isFinite(dur) && g('cq_dur') ? dur : null, durationLabel: g('cq_dl'), thumbnail: g('cq_thumb') },
      { forceQPlus: g('cq_q') === '1', scheduledAt: g('cq_at') ? Number(g('cq_at')) : null }
    );
  }
  const clearHash = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { location.hash = ''; } };
  window.addEventListener('hashchange', processHash);

  // ══ boot ═════════════════════════════════════════════════════════
  if (!document.body) await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  S.roomLimit = Math.max(2, Number(await store.get(KEYS.roomLimit, CQ.DEFAULT_ROOM_LIMIT)) || CQ.DEFAULT_ROOM_LIMIT);
  await buildFloat();
  askBridge();
  setTimeout(askBridge, 800);
  await refreshAccountScope();
  await syncSiteTheme();
  armScheduleTimer();

  // Account scope: re-check on login-UI changes and auth button clicks
  const accRefresh = CQ.debounce(refreshAccountScope, 80);
  const accObs = new MutationObserver(accRefresh);
  ['#welcome', '#username', '#chatheader', '.user-dropdown', '#userlist', '#login-bar'].forEach((sel) => {
    const n = $(sel);
    if (n) accObs.observe(n, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-username'] });
  });
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#btn-logout, #logout, a[href*="logout"], .logout, [data-action="logout"]')) forceLogoutScope();
    else if (t.closest('#btn-login, #login, a[href*="login"], .login, [data-action="login"]')) noteLoginAttempt();
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { askBridge(); refreshAccountScope(); syncSiteTheme(); } });
  setInterval(refreshAccountScope, 5000);

  // Site theme / v2 day-night changes
  document.addEventListener('change', (e) => { if (e.target && (e.target.tagName === 'SELECT' || e.target.id === 'usertheme')) setTimeout(syncSiteTheme, 30); }, true);
  try {
    const obs = new MutationObserver(syncSiteThemeSoon);
    const attrs = { attributes: true, attributeFilter: ['class', 'data-theme', 'data-phase', 'style'] };
    obs.observe(document.documentElement, attrs);
    obs.observe(document.body, attrs);
    const phaseFinder = new MutationObserver(observePhaseElement);
    phaseFinder.observe(document.body, { childList: true, subtree: true });
    observePhaseElement();
    const link = $('#usertheme');
    if (link) obs.observe(link, { attributes: true, attributeFilter: ['href'] });
    if (document.head) obs.observe(document.head, { childList: true });
  } catch (_) { /* ignore */ }

  setInterval(syncSiteTheme, 30000);
  setTimeout(processHash, 600);
  setTimeout(tryAutoQueue, 2000);
})();
