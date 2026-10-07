/* Cool Pills — options.js */
(async () => {
  'use strict';
  const CQ = self.CQ;
  const { store, api } = CQ;
  await CQ.settings.ready;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const status = (t) => { $('status').textContent = t; setTimeout(() => ($('status').textContent = ''), 4000); };

  const BOOLS = ['grayButtons', 'disableCinemaIdleHide', 'unAfk', 'autoFocus', 'qPlusEnabled', 'autoQueue', 'forceIgnoreLimit', 'goldChatHist', 'genericEnabled'];

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

  // shortcuts (live bindings)
  try {
    const cmds = await api.commands.getAll();
    const ul = $('shortcuts');
    cmds.filter((c) => c.name !== '_execute_action').forEach((c) => {
      const li = el('li', null, c.description || c.name);
      li.append(el('code', null, c.shortcut || 'unassigned'));
      ul.append(li);
    });
  } catch (_) { /* ignore */ }

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
