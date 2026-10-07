/* Cool Pills — options.js */
(async () => {
  'use strict';
  const CQ = self.CQ;
  const { store, api } = CQ;
  await CQ.settings.ready;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const status = (t) => { $('status').textContent = t; setTimeout(() => ($('status').textContent = ''), 4000); };
  $('updateStatus').textContent = 'Installed version ' + api.runtime.getManifest().version + '.';

  const compareVersions = (left, right) => {
    const parse = (version) => {
      const match = String(version).match(/^v?(\d+)\.(\d+)\.(\d+)$/);
      return match ? match.slice(1).map(Number) : null;
    };
    const a = parse(left);
    const b = parse(right);
    if (!a || !b) throw new Error('GitHub returned an invalid version number.');
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  };

  $('checkUpdates').addEventListener('click', async () => {
    const button = $('checkUpdates');
    const message = $('updateStatus');
    const linkBox = $('updateLink');
    button.disabled = true;
    message.textContent = 'Checking GitHub for the latest release…';
    linkBox.replaceChildren();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('https://api.github.com/repos/asoapyoid/coolpills/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('GitHub returned HTTP ' + response.status + '.');
      const release = await response.json();
      const currentVersion = api.runtime.getManifest().version;
      const latestVersion = String(release.tag_name || '').replace(/^v/, '');
      if (compareVersions(latestVersion, currentVersion) <= 0) {
        message.textContent = 'You are up to date (v' + currentVersion + ').';
        return;
      }

      const browserName = /firefox/i.test(navigator.userAgent) ? 'firefox' : 'chrome';
      const assetName = 'cool-pills-' + browserName + '-' + latestVersion + '.zip';
      const asset = Array.isArray(release.assets) && release.assets.find((item) => item.name === assetName);
      message.textContent = 'Cool Pills v' + latestVersion + ' is available (you have v' + currentVersion + ').';
      if (asset && /^https:\/\/github\.com\/asoapyoid\/coolpills\/releases\/download\//.test(asset.browser_download_url)) {
        const download = el('a', null, 'Download update for ' + (browserName === 'firefox' ? 'Firefox' : 'Chrome / Edge / Brave'));
        download.href = asset.browser_download_url;
        download.rel = 'noopener';
        download.setAttribute('download', assetName);
        linkBox.append(download);
      } else {
        const releaseLink = el('a', null, 'Open v' + latestVersion + ' release on GitHub');
        releaseLink.href = release.html_url;
        releaseLink.rel = 'noopener';
        linkBox.append(releaseLink);
        message.textContent += ' The browser download ZIP is not attached yet.';
      }
    } catch (error) {
      message.textContent = error.name === 'AbortError'
        ? 'Could not check for updates: the GitHub request timed out.'
        : 'Could not check for updates: ' + error.message;
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
    }
  });

  const BOOLS = ['grayButtons', 'disableCinemaIdleHide', 'unAfk', 'autoFocus', 'qPlusEnabled', 'autoQueue', 'openNewCoolholeTab', 'forceIgnoreLimit', 'goldChatHist', 'genericEnabled'];

  function fill() {
    const s = CQ.settings.cur;
    $('theme').value = s.matchCoolholeTheme ? 'match' : s.theme;
    $('cpMode').value = s.cpMode;
    $('uiMode').value = s.uiMode;
    document.documentElement.setAttribute('data-mode', s.uiMode);
    $('maxQueued').value = s.maxQueued;
    BOOLS.forEach((k) => ($(k).checked = s[k]));
    [['ytOpacity', 10], ['holeOpacity', 0]].forEach(([k]) => {
      $(k).value = Math.round(s[k] * 100);
      $(k + 'V').textContent = $(k).value + '%';
    });
    renderSites();
  }

  function renderSites() {
    const s = CQ.settings.cur;
    const box = $('sites');
    box.replaceChildren();
    CQ.adapters.list.forEach((a) => {
      const lab = el('label', 'check');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = !s.disabledSites.includes(a.id);
      cb.addEventListener('change', () => {
        const set = new Set(CQ.settings.cur.disabledSites);
        cb.checked ? set.delete(a.id) : set.add(a.id);
        CQ.settings.save({ disabledSites: [...set] });
      });
      lab.append(cb, document.createTextNode(' ' + a.label));
      box.append(lab);
    });
    const list = $('siteList');
    list.replaceChildren();
    s.disabledSites.filter((x) => !CQ.adapters.list.some((a) => a.id === x)).forEach((host) => {
      const li = el('li', null, host);
      const rm = el('button', 'danger', 'Remove');
      rm.type = 'button';
      rm.addEventListener('click', () => CQ.settings.save({ disabledSites: CQ.settings.cur.disabledSites.filter((h) => h !== host) }).then(renderSites));
      li.append(rm);
      list.append(li);
    });
  }

  $('theme').addEventListener('change', () => {
    const v = $('theme').value;
    CQ.settings.save(v === 'match' ? { matchCoolholeTheme: true } : { matchCoolholeTheme: false, theme: v });
  });
  $('uiMode').addEventListener('change', () => CQ.settings.save({ uiMode: $('uiMode').value }));
  $('cpMode').addEventListener('change', () => CQ.settings.save({ cpMode: $('cpMode').value }));
  $('maxQueued').addEventListener('change', () => CQ.settings.save({ maxQueued: $('maxQueued').value }));
  BOOLS.forEach((k) => $(k).addEventListener('change', () => CQ.settings.save({ [k]: $(k).checked })));
  ['ytOpacity', 'holeOpacity'].forEach((k) =>
    $(k).addEventListener('input', () => {
      $(k + 'V').textContent = $(k).value + '%';
      CQ.settings.save({ [k]: Number($(k).value) / 100 });
    })
  );
  $('siteAdd').addEventListener('click', () => {
    const h = $('siteInput').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!h) return;
    $('siteInput').value = '';
    CQ.settings.save({ disabledSites: [...new Set([...CQ.settings.cur.disabledSites, h])] }).then(renderSites);
  });

  // Keyboard shortcuts are updated through the browser commands API.
  const SHORTCUTS = [
    ['queue-current', 'Queue current or hovered video'],
    ['work', 'Focus Coolhole and go Fishing'],
    ['toggle-panel', 'Toggle the Hist / Q+ panel'],
  ];
  const canUpdateShortcuts = typeof api.commands.update === 'function';
  let recordingHandler = null;
  let recordingCleanup = null;
  const cancelShortcutRecording = () => {
    if (recordingHandler) document.removeEventListener('keydown', recordingHandler, true);
    recordingHandler = null;
    if (recordingCleanup) recordingCleanup();
    recordingCleanup = null;
  };
  const shortcutSettings = () => CQ.settings.cur.keyboardShortcuts || {};
  const shortcutLabel = (shortcut) => shortcut || 'Unassigned';
  const renderShortcuts = () => {
    const box = $('shortcutControls');
    box.replaceChildren();
    const enabled = CQ.settings.cur.keyboardShortcutsEnabled;
    SHORTCUTS.forEach(([name, label]) => {
      const row = el('div', 'shortcut-row');
      row.append(el('span', null, label));
      const button = el('button', 'shortcut-button', shortcutLabel(shortcutSettings()[name]));
      button.type = 'button';
      button.disabled = !enabled;
      button.addEventListener('click', () => {
        if (!canUpdateShortcuts) {
          $('shortcutStatus').textContent = 'This browser does not allow extensions to remap shortcuts here. Use the browser shortcut settings link below.';
          return;
        }
        cancelShortcutRecording();
        button.classList.add('recording');
        button.textContent = 'Press shortcut… (Esc to cancel)';
        button.focus();
        $('shortcutStatus').textContent = '';
        const stopRecording = () => button.classList.remove('recording');
        recordingCleanup = () => {
          stopRecording();
          button.textContent = shortcutLabel(shortcutSettings()[name]);
        };
        const onKeyDown = async (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.key === 'Escape') {
            document.removeEventListener('keydown', onKeyDown, true);
            recordingHandler = null;
            recordingCleanup = null;
            stopRecording();
            button.textContent = shortcutLabel(shortcutSettings()[name]);
            return;
          }
          if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
          const modifiers = [];
          const isMac = /mac/i.test(navigator.platform);
          if (event.ctrlKey) modifiers.push(isMac ? 'MacCtrl' : 'Ctrl');
          if (event.metaKey) modifiers.push(isMac ? 'Command' : 'Ctrl');
          if (event.altKey) modifiers.push(isMac ? 'Option' : 'Alt');
          if (event.shiftKey) modifiers.push('Shift');
          let key = event.key;
          if (key === ' ') key = 'Space';
          else if (key.startsWith('Arrow')) key = key.slice(5);
          else if (/^[a-z]$/i.test(key)) key = key.toUpperCase();
          if (!modifiers.some((modifier) => ['Ctrl', 'Alt', 'MacCtrl', 'Command', 'Option'].includes(modifier)) ||
              !/^(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Space|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Comma|Period)$/.test(key)) {
            $('shortcutStatus').textContent = 'Use Ctrl or Alt (Command or Option on Mac) with a letter, number, function or navigation key.';
            return;
          }
          const shortcut = [...modifiers, key].join('+');
          if (SHORTCUTS.some(([other]) => other !== name && shortcutSettings()[other] === shortcut)) {
            $('shortcutStatus').textContent = 'That shortcut is already assigned to another Cool Pills action.';
            return;
          }
          document.removeEventListener('keydown', onKeyDown, true);
          recordingHandler = null;
          recordingCleanup = null;
          stopRecording();
          button.disabled = true;
          try {
            await api.commands.update({ name, shortcut });
            const saved = { ...shortcutSettings(), [name]: shortcut };
            await CQ.settings.save({ keyboardShortcuts: saved });
            $('shortcutStatus').textContent = 'Shortcut saved. The browser may reject combinations it reserves.';
          } catch (error) {
            $('shortcutStatus').textContent = 'Could not set shortcut: ' + (error.message || String(error));
          } finally {
            button.disabled = !CQ.settings.cur.keyboardShortcutsEnabled;
            renderShortcuts();
          }
        };
        recordingHandler = onKeyDown;
        document.addEventListener('keydown', onKeyDown, true);
      });
      row.append(button);
      box.append(row);
    });
  };

  $('keyboardShortcutsEnabled').addEventListener('change', async () => {
    const checkbox = $('keyboardShortcutsEnabled');
    const nextEnabled = checkbox.checked;
    if (!nextEnabled && recordingHandler) {
      cancelShortcutRecording();
      renderShortcuts();
    }
    checkbox.disabled = true;
    $('shortcutStatus').textContent = nextEnabled ? 'Enabling shortcuts…' : 'Disabling shortcuts…';
    try {
      const saved = { ...shortcutSettings() };
      if (canUpdateShortcuts) {
        const commands = await api.commands.getAll();
        const previous = Object.fromEntries(commands.map((command) => [command.name, command.shortcut || '']));
        if (!nextEnabled) {
          SHORTCUTS.forEach(([name]) => {
            if (previous[name]) saved[name] = previous[name];
          });
        }
        const target = nextEnabled ? saved : Object.fromEntries(SHORTCUTS.map(([name]) => [name, '']));
        const changed = [];
        try {
          for (const [name, shortcut] of Object.entries(target)) {
            await api.commands.update({ name, shortcut });
            changed.push(name);
          }
        } catch (error) {
          const rollbackErrors = [];
          for (const name of changed.reverse()) {
            try {
              await api.commands.update({ name, shortcut: previous[name] || '' });
            } catch (rollbackError) {
              rollbackErrors.push(name + ': ' + (rollbackError.message || String(rollbackError)));
            }
          }
          if (rollbackErrors.length) {
            error.message += ' Rollback was incomplete for ' + rollbackErrors.join('; ') + '.';
          }
          throw error;
        }
      }
      await CQ.settings.save({ keyboardShortcutsEnabled: nextEnabled, keyboardShortcuts: saved });
      $('shortcutStatus').textContent = canUpdateShortcuts
        ? (nextEnabled ? 'Keyboard shortcuts enabled.' : 'Keyboard shortcuts disabled.')
        : (nextEnabled ? 'Keyboard shortcut actions enabled.' : 'Keyboard shortcut actions disabled. The browser bindings remain assigned.');
    } catch (error) {
      checkbox.checked = CQ.settings.cur.keyboardShortcutsEnabled;
      $('shortcutStatus').textContent = 'Could not update shortcuts: ' + (error.message || String(error));
    } finally {
      checkbox.disabled = false;
      renderShortcuts();
    }
  });
  try {
    const commands = await api.commands.getAll();
    const actual = Object.fromEntries(commands.map((command) => [command.name, command.shortcut || '']));
    const saved = shortcutSettings();
    const configured = Object.fromEntries(SHORTCUTS.map(([name]) => [
      name,
      actual[name] || (!CQ.settings.cur.keyboardShortcutsEnabled ? saved[name] : '') || '',
    ]));
    if (Object.entries(configured).some(([name, shortcut]) => shortcut && shortcut !== saved[name])) {
      await CQ.settings.save({ keyboardShortcuts: { ...saved, ...configured } });
    }
  } catch (error) {
    $('shortcutStatus').textContent = 'Could not load keyboard shortcuts: ' + (error.message || String(error));
  }
  $('keyboardShortcutsEnabled').checked = CQ.settings.cur.keyboardShortcutsEnabled;
  $('shortcutManager').href = /firefox/i.test(navigator.userAgent)
    ? 'about:addons'
    : /edg/i.test(navigator.userAgent)
      ? 'edge://extensions/shortcuts'
      : /brave/i.test(navigator.userAgent)
        ? 'brave://extensions/shortcuts'
        : 'chrome://extensions/shortcuts';
  renderShortcuts();
  CQ.settings.onChange(() => {
    $('keyboardShortcutsEnabled').checked = CQ.settings.cur.keyboardShortcutsEnabled;
    renderShortcuts();
  });

  // export / import (everything prefixed cq_, incl. per-account Q+/history/pins)
  $('export').addEventListener('click', async () => {
    const all = await store.all();
    const out = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('cq_') && k !== CQ.KEYS.snap && k !== CQ.KEYS.workCd));
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ cool_pills: 1, data: out }, null, 2)], { type: 'application/json' }));
    a.download = 'cool-pills-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
    status('Exported ' + Object.keys(out).length + ' keys');
  });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    try {
      const file = $('importFile').files[0];
      if (!file) return;
      const json = JSON.parse(await file.text());
      const data = json && json.data && typeof json.data === 'object' ? json.data : json;
      let n = 0;
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith('cq_')) continue;
        await store.set(k, k === CQ.KEYS.settings ? CQ.normalizeSettings(v) : v);
        n++;
      }
      await CQ.settings.load();
      fill();
      status('Imported ' + n + ' keys');
    } catch (e) {
      status('Import failed: ' + e.message);
    }
    $('importFile').value = '';
  });

  CQ.settings.onChange(fill);
  fill();
})();
