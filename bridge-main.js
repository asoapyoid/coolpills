/* Cool Pills — bridge-main.js  (runs in the PAGE world on coolhole.org only)
 * Content scripts are isolated from page globals, so this tiny bridge relays CLIENT / CURRENT /
 * SOCKET to the extension via window.postMessage. No eval; only same-window messages accepted.
 */
(() => {
  'use strict';
  if (window.__cqBridge) return;
  window.__cqBridge = true;

  const snapshot = () => {
    let client = null;
    let current = null;
    try {
      if (typeof CLIENT !== 'undefined' && CLIENT) {
        client = { name: CLIENT.name, logged_in: CLIENT.logged_in, guest: CLIENT.guest, rank: CLIENT.rank };
      }
    } catch (_) { /* ignore */ }
    try {
      if (typeof CURRENT !== 'undefined' && CURRENT && CURRENT.media) {
        current = { id: CURRENT.media.id, title: CURRENT.media.title };
      }
    } catch (_) { /* ignore */ }
    return { client, current };
  };

  let last = '';
  const post = (force) => {
    const state = snapshot();
    const sig = JSON.stringify(state);
    if (!force && sig === last) return;
    last = sig;
    window.postMessage({ source: 'cq-bridge', type: 'state', state }, '*');
  };

  const sendChat = (msg) => {
    try {
      const sock =
        (typeof SOCKET !== 'undefined' && SOCKET) || (typeof socket !== 'undefined' && socket) || null;
      if (sock && typeof sock.emit === 'function') {
        sock.emit('chatMsg', { msg, meta: {} });
        return true;
      }
    } catch (_) { /* fall through */ }
    try {
      const input = document.querySelector('#chatline');
      if (!input) return false;
      const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(input, msg);
      else input.value = msg;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      return true;
    } catch (_) {
      return false;
    }
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== 'cq-ext') return;
    if (d.type === 'request-state') post(true);
    else if (d.type === 'chat' && typeof d.msg === 'string') {
      window.postMessage({ source: 'cq-bridge', type: 'chat-result', id: d.id, ok: sendChat(d.msg.slice(0, 500)) }, '*');
    }
  });

  setInterval(() => post(false), 1000);
  post(true);
})();
