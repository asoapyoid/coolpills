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
  const redditMediaChannel = 'coolpills:reddit-media';
  const requestRedditDashUrl = (postUrl) => new Promise((resolve) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => finish(null), 7000);
    const finish = (result) => {
      clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      resolve(result);
    };
    const onMessage = (event) => {
      const message = event.data;
      if (event.source !== window || event.origin !== location.origin ||
          !message || message.channel !== redditMediaChannel ||
          message.type !== 'dash-result' || message.id !== id) return;
      finish(message);
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ channel: redditMediaChannel, type: 'get-dash', id, postUrl }, location.origin);
  });
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
      this.resolvedMedia = new Map();
      this.resolvingMedia = new Map();
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
        ctx = this.withResolvedMedia(t.ctx());
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

    withResolvedMedia(ctx) {
      if (!ctx || !ctx.platform || !ctx.postUrl) return ctx;
      const resolved = this.resolvedMedia.get(ctx.platform + ':' + ctx.postUrl);
      return resolved ? { ...ctx, ...resolved, postUrl: ctx.postUrl } : ctx;
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
        const live = this.cur && this.cur.ctx && this.withResolvedMedia(this.cur.ctx());
        if (live && live.url === ctx.url) return live;
      } catch (_) { /* ignore */ }
      return ctx;
    }
    async queue(ctx, extra) {
      let c = this.withResolvedMedia(this.fresh(ctx));
      if (!c || !c.url) return;
      const cacheKey = c.platform + ':' + c.postUrl;
      if (c.postUrl && ['x', 'reddit', 'facebook', 'instagram', 'tiktok'].includes(c.platform) &&
        !CQ.isNativeCoolholeUrl(c.postUrl) &&
        !this.resolvedMedia.has(cacheKey)) {
        const siteName = {
          x: 'X', reddit: 'Reddit', facebook: 'Facebook',
          instagram: 'Instagram', tiktok: 'TikTok',
        }[c.platform];
        let pending = this.resolvingMedia.get(cacheKey);
        if (!pending) {
          ui.toast('Looking up a direct ' + siteName + ' media link...', 'queue');
          pending = CQ.send({ type: 'cq:resolve-social-video', platform: c.platform, postUrl: c.postUrl });
          this.resolvingMedia.set(cacheKey, pending);
        }
        let resolution;
        try {
          resolution = await pending;
        } catch (error) {
          resolution = { ok: false, error: String(error && error.message || error) };
        } finally {
          if (this.resolvingMedia.get(cacheKey) === pending) this.resolvingMedia.delete(cacheKey);
        }
        if (!resolution || !resolution.ok || !/^https:\/\//i.test(String(resolution.url || ''))) {
          const error = resolution && resolution.error || 'The resolver did not respond.';
          if (c.platform === 'reddit') {
            ui.toast('Reddit MP4 lookup failed. Checking the signed-in page for its audio/video manifest…', 'queue');
            const media = await requestRedditDashUrl(c.postUrl);
            const dashUrl = media && /^https:\/\/v\.redd\.it\/[^?#]*\/DASHPlaylist\.mpd(?:[?#]|$)/i.test(media.dashUrl || '')
              ? media.dashUrl : null;
            if (!dashUrl) {
              const reason = media && media.error || 'The signed-in page did not expose a Reddit DASH playlist.';
              ui.toast('Could not recover this Reddit video with audio: ' + reason + ' ' + error, 'error');
              return { ok: false, error: reason };
            }
            ui.toast('Found Reddit’s audio/video manifest. Sending it to Coolhost to combine and process…', 'queue');
            const mediaTitle = CQ.cleanTitle(media.title) || CQ.cleanTitle(c.title);
            const mediaDuration = Number(media.duration);
            let fallback;
            try {
              fallback = await CQ.send({
                type: 'cq:coolhost-upload',
                payload: {
                  url: dashUrl,
                  postUrl: c.postUrl,
                  title: mediaTitle && !/^raw video$/i.test(mediaTitle) ? mediaTitle : null,
                  duration: Number.isFinite(mediaDuration) && mediaDuration > 0 && mediaDuration < 172800
                    ? Math.round(mediaDuration) : null,
                  thumbnail: media.thumbnail || c.thumbnail || null,
                  platform: 'reddit',
                },
              });
            } catch (uploadError) {
              fallback = { ok: false, error: String(uploadError && uploadError.message || uploadError) };
            }
            if (!fallback || fallback.ok === false) {
              ui.toast('Could not start Reddit recovery on Coolhost: ' +
                String(fallback && fallback.error || 'the extension did not respond.'), 'error');
            } else {
              ui.toast('Coolhost is processing the Reddit video in the background.', 'queue');
            }
            return fallback;
          }
          ui.toast(siteName + ' direct-link lookup failed; trying the original post link. ' + error, 'queue');
          c = { ...c, url: c.postUrl, supported: 'maybe' };
        } else {
          const resolved = {
            url: resolution.url,
            title: resolution.title || c.title,
            duration: resolution.duration != null ? resolution.duration : c.duration,
            durationLabel: resolution.duration != null ? CQ.formatDuration(resolution.duration) : c.durationLabel,
            thumbnail: resolution.thumbnail || c.thumbnail,
            supported: 'yes',
          };
          this.resolvedMedia.set(cacheKey, resolved);
          c = { ...c, ...resolved };
          if (this.cur && this.cur.ctxValue && this.cur.ctxValue.postUrl === c.postUrl) {
            this.cur.ctxValue = c;
            this.pill.setContext(c);
            this.refreshMode();
          }
        }
      }
      const result = await CQ.send({ type: 'cq:queue', payload: this.payload(c, extra) });
      if (!result || result.ok === false) {
        ui.toast('Could not send the video to Coolhole. ' +
          String(result && result.error || 'Check that the extension is enabled and try again.'), 'error');
      }
      return result;
    }
    unqueue(ctx) {
      CQ.send({ type: 'cq:unqueue', payload: { url: ctx.url, videoId: ctx.videoId || null } });
    }
    async copyLink(ctx) {
      const url = ctx && ctx.url;
      if (!url) return ui.toast('No video link found to copy.', 'error');
      try {
        await navigator.clipboard.writeText(url);
        ui.toast('Video link copied', 'queue');
      } catch (_) {
        ui.toast('Could not copy the link — the browser blocked clipboard access.', 'error');
      }
    }
    async custom() {
      const steps = String(CQ.settings.cur.cpCustomSteps || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10);
      if (!steps.length) return ui.toast('Custom CP has no steps yet. Add CSS selectors in Options → CP button.', 'error');
      const result = await CQ.send({ type: 'cq:custom', payload: { steps } });
      if (!result || result.ok === false) ui.toast(String((result && result.error) || 'Custom CP action failed.'), 'error');
    }
    async work() {
      CQ.send({ type: 'cq:work' });
    }
    cpClick(ctx) {
      const mode = CQ.settings.cur.cpMode;
      if (ctx && mode === 'schedule') return this.pill.openSchedule(ctx);
      if (ctx && mode === 'qplus') return this.queue(ctx, { forceQPlus: true });
      if (mode === 'none') return;
      if (mode === 'copy') return this.copyLink(ctx || this.currentContext());
      if (mode === 'open') return void CQ.send({ type: 'cq:open-hole' });
      if (mode === 'custom') return this.custom();
      this.work();
    }

    /** Context for keyboard-shortcut queueing: targeted → watch page → largest visible <video> */
    currentContext() {
      if (this.cur && this.cur.ctxValue) return this.fresh(this.cur.ctxValue);
      try {
        if (this.adapter.watchContext) {
          const c = this.withResolvedMedia(this.adapter.watchContext());
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
      return best ? this.withResolvedMedia(this.adapter.context(best)) : null;
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
