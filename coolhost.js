/* Cool Pills integration for completed Coolhost uploads and failed-link recovery. */
'use strict';

(() => {
  const api = typeof browser !== 'undefined' && browser.runtime ? browser : chrome;
  const processing = new Set();

  function localToast(message, isError = false) {
    let toast = document.getElementById('coolpills-coolhost-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'coolpills-coolhost-toast';
      Object.assign(toast.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: '2147483647',
        maxWidth: 'min(420px, calc(100vw - 40px))',
        padding: '12px 16px',
        borderRadius: '8px',
        color: '#fff',
        background: '#263238',
        boxShadow: '0 4px 18px rgba(0,0,0,.4)',
        font: '14px/1.4 system-ui, sans-serif',
      });
      (document.body || document.documentElement).appendChild(toast);
    }
    toast.textContent = message;
    toast.style.border = isError ? '1px solid #e57373' : '1px solid #607d8b';
    clearTimeout(toast._cqTimer);
    toast._cqTimer = setTimeout(() => toast.remove(), 6000);
  }

  async function notifyHole(message) {
    try {
      const result = await api.runtime.sendMessage({
        type: 'cq:coolhost-status',
        payload: { message },
      });
      if (result && result.ok) return;
    } catch (error) {
      console.warn('[CoolPills] could not show Coolhost status in Coolhole', error);
    }
    localToast(message, true);
  }

  function completedMediaUrl(value) {
    try {
      const url = new URL(String(value || ''), location.origin);
      if (url.protocol !== 'https:' ||
          !['coolhost.ca', 'www.coolhost.ca'].includes(url.hostname) ||
          !url.pathname.toLowerCase().startsWith('/f/') ||
          !url.pathname.toLowerCase().endsWith('.mp4')) return null;
      return url.href;
    } catch (_) {
      return null;
    }
  }

  async function queueUpload(url, title, button) {
    if (button.disabled) return;
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = 'Sending…';
    try {
      const result = await api.runtime.sendMessage({
        type: 'cq:queue',
        payload: { url, title: title || null },
      });
      if (!result || result.ok === false) {
        throw new Error(result && result.error || 'Could not contact Coolhole.');
      }
      button.textContent = 'Sent';
      setTimeout(() => { button.textContent = oldText; button.disabled = false; }, 1800);
    } catch (error) {
      button.textContent = oldText;
      button.disabled = false;
      const message = 'Could not send the Coolhost video to Coolhole: ' +
        String(error && error.message || error);
      localToast(message, true);
      await notifyHole(message);
    }
  }

  function addQueueButton(container, url, title, after) {
    const mediaUrl = completedMediaUrl(url);
    if (!mediaUrl || container.querySelector('.coolpills-coolhost-queue')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-sm coolpills-coolhost-queue';
    button.textContent = 'CH';
    button.title = 'Send this Coolhost video to Coolhole';
    button.setAttribute('aria-label', 'Send this Coolhost video to Coolhole');
    button.style.marginLeft = '6px';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void queueUpload(mediaUrl, title, button);
    });
    after(button);
  }

  function scanHistory() {
    document.querySelectorAll('.history-card').forEach((card) => {
      const status = card.querySelector('.history-status.expired');
      if (status) {
        card.querySelectorAll('.coolpills-coolhost-queue').forEach((button) => button.remove());
        return;
      }
      const copy = card.querySelector('.history-copy-btn');
      const url = copy && copy.dataset.url || card.dataset.url;
      const title = card.querySelector('.history-name')?.textContent?.trim() || '';
      if (!url || !copy) return;
      addQueueButton(card, url, title, (button) => copy.insertAdjacentElement('afterend', button));
    });

    document.querySelectorAll('.upload-row').forEach((row) => {
      const link = row.querySelector('.upload-row-link');
      const mediaUrl = link && completedMediaUrl(link.textContent.trim());
      if (!mediaUrl) return;
      let actions = row.querySelector('.upload-row-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'upload-row-actions';
        row.appendChild(actions);
      }
      const copy = actions.querySelector('button');
      const title = row.querySelector('.upload-row-filename')?.textContent?.trim() || '';
      addQueueButton(actions, mediaUrl, title, (button) => {
        if (copy) copy.insertAdjacentElement('afterend', button);
        else actions.appendChild(button);
      });
    });
  }

  async function processUpload(payload) {
    const url = String(payload && payload.url || '').trim();
    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      await notifyHole('Coolhost could not process the rejected video: its link was invalid.');
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol) ||
        parsed.hostname === 'coolhost.ca' || parsed.hostname === 'www.coolhost.ca') {
      await notifyHole('Coolhost could not process the rejected video: the source link is unsupported.');
      return;
    }
    if (processing.has(parsed.href)) return;
    processing.add(parsed.href);

    try {
      localToast('Sending media link to Coolhost for processing…');
      await notifyHole('Coolhost started processing the video in the background.');
      const response = await fetch(new URL('/api/upload-from-url', location.origin), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parsed.href, title: String(payload.title || '').slice(0, 200) }),
      });
      let data;
      try {
        data = await response.json();
      } catch (_) {
        throw new Error('Coolhost returned an unreadable response.');
      }
      if (!response.ok) {
        throw new Error(String(data && data.error || `Coolhost rejected the request (${response.status}).`));
      }
      if (!data || !data.id || !data.progress_url) {
        throw new Error('Coolhost did not return an upload progress link.');
      }
      localToast('Coolhost accepted the video. Processing…');
      await notifyHole('Coolhost accepted the video and is processing it in the background.');

      const progressUrl = new URL(data.progress_url, location.origin);
      if (progressUrl.protocol !== 'https:' ||
          !['coolhost.ca', 'www.coolhost.ca'].includes(progressUrl.hostname)) {
        throw new Error('Coolhost returned an invalid progress link.');
      }
      const finalUrl = await new Promise((resolve, reject) => {
        const events = new EventSource(progressUrl.href);
        const timeout = setTimeout(() => {
          events.close();
          reject(new Error('Coolhost processing timed out.'));
        }, 30 * 60 * 1000);
        let disconnectTimer;
        const finish = (callback, value) => {
          clearTimeout(timeout);
          clearTimeout(disconnectTimer);
          events.close();
          callback(value);
        };
        events.onopen = () => clearTimeout(disconnectTimer);
        events.onmessage = (event) => {
          clearTimeout(disconnectTimer);
          let progress;
          try {
            progress = JSON.parse(event.data);
          } catch (_) {
            finish(reject, new Error('Coolhost sent invalid processing progress.'));
            return;
          }
          if (!progress || !progress.done) return;
          if (progress.status !== 'done') {
            finish(reject, new Error(String(progress.error || 'Coolhost could not process this video.')));
            return;
          }
          const output = completedMediaUrl(progress.url || `/f/${encodeURIComponent(data.id)}.mp4`);
          if (!output) {
            finish(reject, new Error('Coolhost finished without returning a valid MP4 link.'));
            return;
          }
          finish(resolve, output);
        };
        events.onerror = () => {
          clearTimeout(disconnectTimer);
          disconnectTimer = setTimeout(() => {
            finish(reject, new Error('Lost connection to Coolhost processing progress.'));
          }, 60000);
        };
      });

      const queued = await api.runtime.sendMessage({
        type: 'cq:queue',
        payload: { url: finalUrl, title: String(payload.title || '').slice(0, 200) || null },
      });
      if (!queued || queued.ok === false) {
        throw new Error(queued && queued.error || 'The processed video could not be sent to Coolhole.');
      }
      localToast('Coolhost finished processing. The MP4 was sent to Coolhole.');
      await notifyHole('Coolhost finished processing; the MP4 was sent to Coolhole.');
    } catch (error) {
      console.error('[CoolPills] Coolhost fallback failed', error);
      const message = 'Could not send the rejected video to Coolhost: ' +
        String(error && error.message || error).slice(0, 240);
      localToast(message, true);
      await notifyHole(message);
    } finally {
      processing.delete(parsed.href);
    }
  }

  api.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message && message.type === 'cq:coolhost-upload') {
      void processUpload(message.payload || {});
      respond({ ok: true });
    }
  });

  function processHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    const url = params.get('cq_upload');
    if (!url) return;
    const title = params.get('cq_title') || '';
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch (_) {
      location.hash = '';
    }
    void processUpload({ url, title });
  }

  const observer = new MutationObserver(scanHistory);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-url'],
  });
  scanHistory();
  processHash();
})();
