/* Cool Pills — detector.js
 * Runs on every non-Coolhole site. Finds the video under the pointer (pointer-driven, so no DOM
 * scanning / MutationObservers / SPA navigation hooks), shows the CH/CP pill, and relays actions
 * to the background worker → Coolhole tab.
 */
(async () => {
  'use strict';
  const CQ = self.CQ;
  if (!CQ || CQ.__detector || window.top !== window) return;
  CQ.__detector = true;
  const { store, KEYS, ui } = CQ;

  await CQ.settings.ready;
  await ui.themeReady;

  const extensionVersion = CQ.api.runtime.getManifest().version;
  const compareVersions = (left, right) => {
    const a = String(left || '0').split('.').map((part) => Number.parseInt(part, 10) || 0);
    const b = String(right || '0').split('.').map((part) => Number.parseInt(part, 10) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0) ? 1 : -1;
    }
    return 0;
  };
  const existingPills = Array.from(document.querySelectorAll('[id="cq-pill-host"]'));
  if (existingPills.some((host) => compareVersions(host.dataset.cqVersion, extensionVersion) >= 0)) return;
  existingPills.forEach((host) => host.remove());

  class VideoDetector {
    constructor() {
      this.adapter = CQ.adapters.forHost(location.hostname);
      this.enabled = CQ.siteEnabled(location.hostname);
      this.cur = null; // currently targeted { key, rect, place, ctx }
      this.px = 0;
      this.py = 0;
      this.moved = false;
      this.raf = 0;
      this.lastRun = 0;
      this.hideT = 0;
      this.snap = { room: [], pending: [] };
      this.pill = ui.createPill({
        onCH: (ctx) => this.queue(ctx),
        onUN: (ctx) => this.unqueue(ctx),
        onCP: (ctx) => this.cpClick(ctx),
        onSchedule: (ctx, ts) => this.queue(ctx, { forceQPlus: true, scheduledAt: ts }),
      });
      this.pill.host.dataset.cqVersion = extensionVersion;
      const pillObserver = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const candidates = [];
            if (node.matches('[id="cq-pill-host"]')) candidates.push(node);
            candidates.push(...node.querySelectorAll('[id="cq-pill-host"]'));
            for (const candidate of candidates) {
              if (candidate === this.pill.host) continue;
              if (compareVersions(candidate.dataset.cqVersion, extensionVersion) > 0) {
                this.pill.host.remove();
                pillObserver.disconnect();
                return;
              }
              candidate.remove();
            }
          }
        }
      });
      pillObserver.observe(document.documentElement, { childList: true, subtree: true });
      this.bind();
    }

    // ── target resolution ──
    resolve(stack) {
      if (stack.some((e) => e === this.pill.host)) return 'pill';
      return this.adapter.resolve(stack);
    }

    tick = () => {
      this.raf = 0;
      if (!this.enabled || !this.moved) return;
      const now = performance.now();
      if (now - this.lastRun < 60) {
        this.raf = requestAnimationFrame(this.tick);
        return;
      }
      this.lastRun = now;
      this.moved = false;
      if (this.pill.menuOpen()) return;
      const t = this.resolve(CQ.deepStack(this.px, this.py));
      if (t === 'pill') return this.cancelHide();
      if (!t) return this.scheduleHide();
      this.cancelHide();
      if (this.cur && this.cur.key === t.key) return;
      let ctx = null;
      try {
        ctx = t.ctx();
      } catch (e) {
        console.warn('[CoolPills] context failed', e);
      }
      if (!ctx || !ctx.url) return this.scheduleHide();
      this.cur = { ...t, ctxValue: ctx };
      this.pill.setContext(ctx);
      this.refreshMode();
      this.pill.show(t.rect(), t.place);
    };

    scheduleHide() {
      if (this.hideT) return;
      this.hideT = setTimeout(() => {
        this.hideT = 0;
        if (this.pill.isHot() || this.pill.menuOpen()) return;
        this.cur = null;
        this.pill.hide(false);
      }, 130);
    }
    cancelHide() {
      clearTimeout(this.hideT);
      this.hideT = 0;
    }

    isQueued(ctx) {
      const key = CQ.mediaKey(ctx.url);
      return this.snap.room.includes(key) || this.snap.pending.includes(key);
    }
    refreshMode() {
      const ctx = this.pill.getContext();
      this.pill.setMode(ctx && this.isQueued(ctx) ? 'un' : 'ch');
    }

    // ── actions ──
    payload(ctx, extra = {}) {
      return {
        url: ctx.url,
        videoId: ctx.videoId || null,
        title: ctx.title || null,
        duration: ctx.duration != null ? ctx.duration : null,
        durationLabel: ctx.durationLabel || null,
        thumbnail: ctx.thumbnail || null,
        supported: ctx.supported || 'maybe',
        site: this.adapter.id,
        forceQPlus: extra.forceQPlus === true,
        scheduledAt: extra.scheduledAt != null ? Number(extra.scheduledAt) : null,
        n: Date.now(),
      };
    }
    /** Re-read volatile fields (Shorts / late-loading durations) right at click time */
    fresh(ctx) {
      try {
        const live = this.cur && this.cur.ctx && this.cur.ctx();
        if (live && live.url === ctx.url) return live;
      } catch (_) { /* ignore */ }
      return ctx;
    }
    queue(ctx, extra) {
      const c = this.fresh(ctx);
      // FUTURE: if (c.supported === 'no' && CQ.hooks.uploadUnsupported) → upload to coolhost.ca first
      CQ.send({ type: 'cq:queue', payload: this.payload(c, extra) });
    }
    unqueue(ctx) {
      CQ.send({ type: 'cq:unqueue', payload: { url: ctx.url, videoId: ctx.videoId || null } });
    }
    async work() {
      const cd = await store.get(KEYS.workCd, null);
      if (cd && cd.ready === false && cd.remainingMs > 0 && cd.startedAt) {
        if (cd.startedAt + Math.max(cd.totalMs || 0, cd.remainingMs) > Date.now() + 500) return; // cooling
      }
      CQ.send({ type: 'cq:work' });
    }
    cpClick(ctx) {
      const mode = CQ.settings.cur.cpMode;
      if (ctx && mode === 'schedule') return this.pill.openSchedule(ctx);
      if (ctx && mode === 'qplus') return this.queue(ctx, { forceQPlus: true });
      this.work();
    }

    /** Context for keyboard-shortcut queueing: targeted → watch page → largest visible <video> */
    currentContext() {
      if (this.cur && this.cur.ctxValue) return this.fresh(this.cur.ctxValue);
      try {
        if (this.adapter.watchContext) {
          const c = this.adapter.watchContext();
          if (c) return c;
        }
      } catch (_) { /* ignore */ }
      let best = null;
      let area = 0;
      document.querySelectorAll('video').forEach((v) => {
        const r = v.getBoundingClientRect();
        const vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
        if (vis > area) { area = vis; best = v; }
      });
      return best ? this.adapter.context(best) : null;
    }

    // ── wiring ──
    bind() {
      document.addEventListener(
        'pointermove',
        (e) => {
          this.px = e.clientX;
          this.py = e.clientY;
          this.moved = true;
          if (!this.raf && this.enabled) this.raf = requestAnimationFrame(this.tick);
        },
        { passive: true, capture: true }
      );
      let scrollT = 0;
      window.addEventListener(
        'scroll',
        () => {
          if (this.pill.menuOpen()) return;
          this.cur = null;
          this.pill.hide(true);
          clearTimeout(scrollT);
          scrollT = setTimeout(() => { this.moved = true; if (!this.raf) this.raf = requestAnimationFrame(this.tick); }, 160);
        },
        { passive: true, capture: true }
      );
      window.addEventListener('resize', () => { this.cur = null; this.pill.hide(true); });
      document.documentElement.addEventListener('mouseleave', () => this.scheduleHide());
      // SPA navigation → drop stale target
      ['yt-navigate-finish', 'popstate'].forEach((ev) => window.addEventListener(ev, () => { this.cur = null; this.pill.hide(true); }));

      store.get(KEYS.snap, null).then((s) => { if (s) { this.snap = { room: s.room || [], pending: s.pending || [] }; } });
      store.watch(KEYS.snap, (s) => {
        this.snap = { room: (s && s.room) || [], pending: (s && s.pending) || [] };
        this.refreshMode();
      });
      CQ.settings.onChange(() => {
        this.enabled = CQ.siteEnabled(location.hostname);
        if (!this.enabled) { this.cur = null; this.pill.hide(true); }
      });
      CQ.api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (!msg) return;
        if (msg.type === 'cq:queue-current') {
          const c = this.currentContext();
          if (c) this.queue(c);
          sendResponse({ ok: !!c });
        }
      });
    }
  }

  new VideoDetector();
})();
