/* Cool Pills — ui.js
 * Theme packs (CSS variables), the CH/CP floating pill (Shadow DOM, DOM APIs only —
 * Trusted-Types safe), CP hold-menu, schedule popover and the toast system.
 */
(() => {
  'use strict';
  const CQ = (self.CQ = self.CQ || {});
  if (CQ.ui) return;
  const { store, KEYS } = CQ;
  const ui = (CQ.ui = {});

  ui.el = (tag, cls, text, attrs) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (attrs) for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const el = ui.el;

  // ══ THEME PACKS ══════════════════════════════════════════════════
  // Every pack is a set of CSS custom properties (--cq-<key>). Hist == "ch" (red side),
  // Q+ == "cp" (blue side). Gradients are fine in ch/cp/shell; chs/cps are solid fallbacks.
  const GRAD_R = 'linear-gradient(180deg,#e53935,#b71c1c)';
  const GRAD_B = 'linear-gradient(180deg,#1184e8,#0a5fad)';
  const NOSH = '0 0 0 0 transparent';
  const BASE = {
    shell: '#2a2a2a', radius: '999px', rad: '8px',
    shadow: '0 2px 10px rgba(0,0,0,.5)',
    font: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', fontsize: '10px', letterspacing: '.06em',
    holefontsize: '12px', holeletterspacing: '.04em',
    tt: 'none', ts: 'none', gloss: '.55',
    chfill: 'rgba(255,255,255,.3)', cpfill: 'rgba(255,255,255,.18)',
    graych: '#3a3a3a', graychfg: '#c8c8c8', graycp: '#3a3a3a', graycpfg: '#c8c8c8',
    ch: GRAD_R, chfg: '#fff', chh: GRAD_R, chhfg: '#fff', chsh: NOSH, chhsh: NOSH,
    cp: GRAD_B, cpfg: '#fff', cph: GRAD_B, cphfg: '#fff', cpsh: NOSH, cphsh: NOSH,
    idlech: '#3a3a3a', idlechfg: '#c8c8c8', idlecp: '#3a3a3a', idlecpfg: '#c8c8c8',
    panel: '#1e1e1e', panelfg: '#eee', edge: '#444', head: '#252525', pilledge: '#444',
    dragbg: '#333', dragfg: '#ccc', dragedge: '#555',
    badge: '#e53935', badgefg: '#fff', badgeb: 'transparent', pattern: 'none',
    tb: 'rgba(255,255,255,.1)', tsh: '0 4px 18px rgba(0,0,0,.4)', tqsh: NOSH, tpsh: NOSH, tgsh: NOSH,
    tf: '#141414', tffg: '#ff8a80', tfb: '#6b1212', tfsh: 'inset 3px 0 0 #c62828',
    tg: 'linear-gradient(135deg,#c9a227,#8a7018)', tgfg: '#1a1200',
  };
  // Palettes follow the approved theme gallery (grok-workspace): idle = muted tint, hover/colored = bright.
  const V2_RED = 'linear-gradient(180deg,#A8454A 0%,#7C1F23 100%)';
  const THEMES = {
    default: {},
    steam: {
      shell: '#4c5844', radius: '0', rad: '0', font: 'Tahoma,"MS Sans Serif",sans-serif',
      fontsize: '11px', holefontsize: '11px', letterspacing: '.04em', ts: '0 1px 0 rgba(0,0,0,.35)', gloss: '0',
      chfill: 'rgba(245,242,224,.28)', cpfill: 'rgba(198,195,181,.3)',
      shadow: 'inset 1px 1px 0 #7a8a62, inset -1px -1px 0 #1b1f14, 0 2px 6px rgba(0,0,0,.4)',
      ch: '#d35400', chh: '#d35400', cp: '#6b7a4e', cpfg: '#f5f2e0', cph: '#6b7a4e', cphfg: '#f5f2e0',
      idlech: '#5c4030', idlechfg: '#e8d8c0', idlecp: '#3e4a2c', idlecpfg: '#c6c3b5',
      panel: '#2f3822', panelfg: '#c6c3b5', edge: '#1b1f14', head: '#2f3822', pilledge: '#1b1f14',
      dragbg: '#2f3822', dragfg: '#c6c3b5', dragedge: '#1b1f14', badge: '#c45500',
      tb: 'transparent', tsh: 'inset 1px 1px 0 #7a8a62, inset -1px -1px 0 #1b1f14', tq: '#5c4030', tqfg: '#e8d8c0',
      tp: '#3e4a2c', tpfg: '#c6c3b5', tf: '#2a2214', tffg: '#e8b060', tfb: 'transparent', tfsh: 'inset 3px 0 0 #c45500',
      tg: '#c45500', tgfg: '#fff', tgsh: 'inset 1px 1px 0 #e8a060, inset -1px -1px 0 #5c2800',
    },
    cobra: {
      shell: '#000', radius: '8px 4px 10px 4px', rad: '8px 4px 10px 4px', font: 'Cinzel,"Times New Roman",serif',
      fontsize: '10px', holefontsize: '11px', holeletterspacing: '.06em', letterspacing: '.04em', gloss: '0',
      chfill: 'rgba(57,255,20,.22)', cpfill: 'rgba(0,0,0,.4)',
      shadow: '0 0 0 1px #0f2a0f, 0 0 10px rgba(57,255,20,.14), 0 2px 10px rgba(0,0,0,.85)',
      ch: '#0f2410', chfg: '#39ff14', chh: '#0f2410', chhfg: '#39ff14',
      cp: '#22c20e', cpfg: '#000', cph: '#22c20e', cphfg: '#000',
      idlech: '#2a2a2a', idlechfg: '#c8c8c8', idlecp: '#2a2a2a', idlecpfg: '#c8c8c8',
      panel: '#000', panelfg: '#39ff14', edge: '#143314', head: '#050705', pilledge: '#0f2a0f',
      dragbg: '#050705', dragfg: '#6fd85a', dragedge: '#143314', badge: '#0a1f0a', badgefg: '#39ff14', badgeb: '#39ff14',
      pattern: 'linear-gradient(135deg,rgba(57,255,20,.1) 25%,transparent 25%),linear-gradient(225deg,rgba(57,255,20,.07) 25%,transparent 25%)',
      tb: '#143314', tq: '#050705', tqfg: '#39ff14', tp: '#050705', tpfg: '#39ff14',
      tf: '#0a0404', tffg: '#ff6b6b', tfb: '#4a1010', tfsh: 'inset 3px 0 0 #39ff14', tg: '#22c20e', tgfg: '#000',
    },
    wc2: {
      shell: 'linear-gradient(180deg,#152056,#0c1438)', radius: '4px', rad: '4px',
      font: 'Georgia,"Times New Roman",serif', holefontsize: '12px', letterspacing: '.03em', ts: 'none', gloss: '0',
      chfill: 'rgba(255,236,160,.28)', cpfill: 'rgba(26,18,0,.3)',
      shadow: '0 0 0 1px #c9a227, 0 2px 12px rgba(0,0,40,.55)',
      ch: '#a01818', chh: '#a01818', cp: '#c9a227', cpfg: '#1a1200', cph: '#c9a227', cphfg: '#1a1200',
      idlech: '#5c1010', idlechfg: '#f5d0d0', idlecp: '#121a4a', idlecpfg: '#e8d5a3',
      panel: '#0c1438', panelfg: '#e8d5a3', edge: '#c9a227', head: '#1a237e', pilledge: '#c9a227',
      dragbg: '#121a4a', dragfg: '#e8d5a3', dragedge: '#c9a227', badge: '#5c1010', badgefg: '#f0d77b', badgeb: '#c9a227',
      tb: '#c9a227', tsh: '0 0 0 1px #0a1030', tq: '#5c1010', tqfg: '#f5d0d0', tp: '#121a4a', tpfg: '#e8d5a3',
      tf: '#1a0c08', tffg: '#f0d77b', tfb: '#8b1a1a', tfsh: 'inset 3px 0 0 #c9a227', tg: '#c9a227', tgfg: '#1a1200',
    },
    coolhole: {
      shell: '#1a2226', shadow: '0 2px 10px rgba(0,0,0,.4)', ch: '#c23b3b', chh: '#c23b3b', cp: '#3c788c', cph: '#3c788c',
      chfill: 'rgba(255,255,255,.3)', cpfill: 'rgba(158,201,214,.35)',
      idlech: '#3a2a2a', idlechfg: '#f0d0d0', idlecp: '#1e3a44', idlecpfg: '#b2dce8',
      panel: '#13191c', panelfg: '#d5eef4', edge: '#2a3a40', head: '#0c1214', pilledge: '#2f4248',
      dragbg: '#13191c', dragfg: '#9ec9d6', dragedge: '#2f4248', badge: '#c23b3b',
      tf: '#12181a', tffg: '#f0b0b0', tfb: '#3a2a2a', tfsh: 'inset 3px 0 0 #c23b3b',
    },
    cinema: {
      shell: '#0a0a0a', radius: '4px', rad: '4px', tt: 'uppercase', gloss: '0', shadow: '0 6px 20px rgba(0,0,0,.75)',
      fontsize: '10px', holefontsize: '10px', letterspacing: '.05em', holeletterspacing: '.05em',
      chfill: 'rgba(255,255,255,.22)', cpfill: 'rgba(255,255,255,.2)',
      ch: '#c42828', chh: '#c42828', chsh: 'inset 0 -3px 0 #7a1010', chhsh: 'inset 0 -3px 0 #7a1010',
      cp: '#3a3a3a', cph: '#3a3a3a', cpsh: 'inset 0 -3px 0 #c62828', cphsh: 'inset 0 -3px 0 #c62828',
      idlech: '#1f1414', idlechfg: '#c8a0a0', idlecp: '#161616', idlecpfg: '#aaa',
      panel: '#0a0a0a', panelfg: '#ddd', edge: '#2a2a2a', head: '#000', pilledge: '#2a2a2a',
      dragbg: '#111', dragfg: '#888', dragedge: '#333', badge: '#9a1c1c',
      tb: '#2a2a2a', tq: '#1f1414', tqfg: '#fff', tqsh: 'inset 0 -3px 0 #7a1010', tp: '#161616', tpfg: '#ddd', tpsh: 'inset 0 -3px 0 #c62828',
      tf: '#120808', tffg: '#e8b0b0', tfb: '#3a1010', tfsh: 'inset 0 -3px 0 #7a1010',
      tg: '#2a2210', tgfg: '#e8d5a3', tgsh: 'inset 0 -3px 0 #8a7018',
    },
    v2day: {
      shell: 'linear-gradient(180deg,#3A4A5E 0%,#131015 75%)', radius: '4px', rad: '4px', gloss: '.3', shadow: '0 2px 12px rgba(0,0,0,.55)',
      chfill: 'rgba(168,69,74,.3)', cpfill: 'rgba(58,74,94,.35)',
      graych: '#5a3838', graychfg: '#e8d0d0', graycp: '#3a5068', graycpfg: '#c8d8e8',
      ch: 'linear-gradient(180deg,#c0392b 0%,#a8454a 100%)', chs: '#C0392B',
      chh: 'linear-gradient(180deg,#c0392b 0%,#a8454a 100%)', chhs: '#C0392B',
      cp: 'linear-gradient(180deg,#5a7a9a 0%,#4a6a8a 100%)', cps: '#5A7A9A',
      cph: 'linear-gradient(180deg,#5a7a9a 0%,#4a6a8a 100%)', cphs: '#5A7A9A',
      idlech: 'linear-gradient(180deg,#A8454A 0%,#7C1F23 100%)', idlechfg: '#EDE6DA',
      idlecp: 'linear-gradient(180deg,#4A6A8A 0%,#3A5470 100%)', idlecpfg: '#E8F0F8',
      panel: '#131015', panelfg: '#EDE6DA', edge: '#3A2E36', head: '#0E0C10', pilledge: '#3A2E36',
      dragbg: '#0E0C10', dragfg: '#EDE6DA', dragedge: '#3A4A5E', badge: '#3A5470', badgefg: '#E8F0F8',
      tq: V2_RED, tqfg: '#ede6da', tp: 'linear-gradient(180deg,#4a6a8a,#3a5470)', tpfg: '#e8f0f8',
      tf: '#0c0a0c', tffg: '#e8c8c4', tfb: '#3a0c10', tfsh: 'inset 3px 0 0 #7c1f23', tg: 'linear-gradient(180deg,#c9a227,#7c1f23)', tgfg: '#ede6da',
    },
    v2night: {
      shell: 'linear-gradient(180deg,#2A0C10 0%,#131015 68%)', radius: '4px', rad: '4px', gloss: '.2',
      shadow: '0 2px 14px rgba(0,0,0,.6), inset 0 -2px 0 rgba(124,31,35,.45)',
      chfill: 'rgba(192,57,43,.3)', cpfill: 'rgba(58,74,94,.32)',
      graych: '#4a3038', graychfg: '#e0c8d0', graycp: '#2a4058', graycpfg: '#b8d0e4',
      ch: 'linear-gradient(180deg,#A8454A 0%,#7C1F23 100%)', chs: '#7C1F23', chfg: '#EDE6DA',
      chh: '#C0392B', chhs: '#C0392B', chhfg: '#fff',
      cp: 'linear-gradient(180deg,#3A5A78 0%,#2A4560 100%)', cps: '#2A4560', cpfg: '#E0ECF6',
      cph: '#4A6A8A', cphs: '#4A6A8A', cphfg: '#041018',
      idlech: 'linear-gradient(180deg,#7C1F23 0%,#3A0C10 100%)', idlechfg: '#EDE6DA',
      idlecp: 'linear-gradient(180deg,#2A4560 0%,#162838 100%)', idlecpfg: '#C8D8E8',
      panel: '#0C0A0C', panelfg: '#EDE6DA', edge: '#2A0C10', head: '#070506', pilledge: '#2A0C10',
      dragbg: '#070506', dragfg: '#C8B8B0', dragedge: '#2A0C10', badge: '#3A0C10', badgefg: '#E8D0D0',
      tq: V2_RED, tqfg: '#ede6da', tp: 'linear-gradient(180deg,#2a4560,#162838)', tpfg: '#c8d8e8',
      tf: '#070506', tffg: '#e8c8c4', tfb: '#2a0c10', tfsh: 'inset 3px 0 0 #7c1f23', tg: 'linear-gradient(180deg,#c9a227,#7c1f23)', tgfg: '#ede6da',
    },
    v2moon: {
      shell: 'linear-gradient(180deg,#1C1226 0%,#221E31 65%)', radius: '4px', rad: '4px', gloss: '.25',
      shadow: '0 2px 14px rgba(0,0,0,.55), 0 0 12px rgba(143,122,196,.15)',
      chfill: 'rgba(168,69,74,.28)', cpfill: 'rgba(143,122,196,.3)',
      graycp: '#3a3858', graycpfg: '#c8c0e0',
      ch: 'linear-gradient(180deg,#A8454A 0%,#7C1F23 100%)', chs: '#7C1F23', chfg: '#EDE6DA',
      chh: '#C0392B', chhs: '#C0392B', chhfg: '#fff',
      cp: 'linear-gradient(180deg,#6A5A9A 0%,#4A3A78 100%)', cps: '#4A3A78', cpfg: '#EDE6DA',
      cph: '#8f7ac4', cphs: '#8f7ac4', cphfg: '#1a1220',
      idlech: 'linear-gradient(180deg,#8B1518 0%,#4A080C 100%)', idlechfg: '#F2D4D0',
      idlecp: 'linear-gradient(180deg,#3A4A78 0%,#2A3458 100%)', idlecpfg: '#E0D8F0',
      panel: '#160C14', panelfg: '#EDE6DA', edge: '#4A1820', head: '#140810', pilledge: '#5C1820',
      dragbg: '#140810', dragfg: '#EDE6DA', dragedge: '#5C1820', badge: '#4A080C', badgefg: '#F2D4D0',
      tq: 'linear-gradient(180deg,#8b1518,#4a080c)', tqfg: '#f2d4d0', tp: 'linear-gradient(180deg,#3a4a78,#2a3458)', tpfg: '#e0d8f0',
      tf: '#12080e', tffg: '#e8c8c4', tfb: '#4a1018', tfsh: 'inset 3px 0 0 #8b1518', tg: 'linear-gradient(180deg,#c9a227,#7c1f23)', tgfg: '#ede6da',
    },
  };
  const PHASE_COLORS = {
    default: {
      day: { shadow: '0 2px 10px rgba(80,60,20,.25)', ch: '#d05040', chh: '#d05040', cp: '#3a8ec0', cph: '#3a8ec0' },
      night: { ch: '#c03848', chh: '#c03848', cp: '#3a78b0', cph: '#3a78b0' },
    },
    coolhole: {
      day: { shell: '#1e2a30', shadow: '0 2px 12px rgba(40,80,90,.4)', ch: '#d04848', chh: '#d04848', cp: '#4aa0b8', cph: '#4aa0b8' },
      night: { shell: '#12181c', shadow: '0 2px 12px rgba(0,20,30,.55)', ch: '#b03040', chh: '#b03040', cp: '#3488a0', cph: '#3488a0' },
    },
    wc2: {
      day: { shell: 'linear-gradient(180deg,#1a2868,#101c48)', shadow: '0 0 0 1px #e0c040, 0 2px 14px rgba(40,40,80,.5)', ch: '#c02020', chh: '#c02020', cp: '#e0c040', cph: '#e0c040', cpfg: '#1a1200', cphfg: '#1a1200' },
      night: { shell: 'linear-gradient(180deg,#0c1438,#080e28)', shadow: '0 0 0 1px #a08020, 0 2px 14px rgba(0,0,30,.7)', ch: '#901818', chh: '#901818', cp: '#c0a030', cph: '#c0a030', cpfg: '#1a1200', cphfg: '#1a1200' },
    },
  };
  ui.THEME_IDS = Object.keys(THEMES);

  /**
   * [data-cq-theme="id"]{ --cq-*: … } for every pack (no !important anywhere).
   * Gradient values can't be used as background-color, so every colour also gets a solid twin
   * (…s) used by Match mode, where the site's own button textures stay on top.
   */
  const isGrad = (v) => /gradient/.test(String(v));
  const solid = (v, fb) => (isGrad(v) ? fb : v);
  ui.themeCss = () =>
    Object.entries(THEMES)
      .map(([id, p]) => {
        const f = { ...BASE, ...p };
        f.chs = p.chs || solid(f.ch, '#c62828');
        f.cps = p.cps || solid(f.cp, '#0a5fad');
        f.chhs = p.chhs || solid(f.chh, f.chs);
        f.cphs = p.cphs || solid(f.cph, f.cps);
        f.idlechs = p.idlechs || solid(f.idlech, f.chs);
        f.idlecps = p.idlecps || solid(f.idlecp, f.cps);
        f.tq = p.tq || f.ch;
        f.tqfg = p.tqfg || f.chfg;
        f.tp = p.tp || f.cp;
        f.tpfg = p.tpfg || f.cpfg;
        const rules = [`[data-cq-theme="${id}"]{${Object.entries(f).map(([k, v]) => `--cq-${k}:${v};`).join('')}}`];
        Object.entries(PHASE_COLORS[id] || {}).forEach(([phase, colors]) => {
          rules.push(`[data-cq-theme="${id}"][data-cq-phase="${phase}"]{${Object.entries(colors).map(([k, v]) => `--cq-${k}:${v};`).join('')}}`);
        });
        return rules.join('\n');
      })
      .join('\n');

  // ── theme state (site theme + v2 day/night phase come from Coolhole via storage) ──
  ui.themeState = { siteTheme: null, phase: 'night' };
  const themeListeners = new Set();
  const emitTheme = () => themeListeners.forEach((fn) => { try { fn(); } catch (_) { /* ignore */ } });
  ui.onTheme = (fn) => { themeListeners.add(fn); return () => themeListeners.delete(fn); };
  const normPhase = (p) => (p === 'day' ? 'day' : p === 'moon' || p === 'moonrise' ? 'moon' : 'night');
  ui.themeReady = (async () => {
    ui.themeState.siteTheme = await store.get(KEYS.siteTheme, null);
    ui.themeState.phase = normPhase(await store.get(KEYS.v2Phase, 'night'));
  })();
  store.watch(KEYS.siteTheme, (v) => { ui.themeState.siteTheme = v; emitTheme(); });
  store.watch(KEYS.v2Phase, (v) => { ui.themeState.phase = normPhase(v); emitTheme(); });
  CQ.settings.onChange(emitTheme);

  /** Which pack id applies right now. Match ON → detected Coolhole theme; unknown → default. */
  ui.themeId = (settings) => {
    const s = settings || CQ.settings.cur;
    if (s.matchCoolholeTheme) {
      const site = ui.themeState.siteTheme;
      if (site === 'v2') return 'v2' + ui.themeState.phase;
      if (['coolhole', 'cinema', 'wc2'].includes(site)) return site;
      return 'default';
    }
    return ['steam', 'cobra'].includes(s.theme) ? s.theme : 'default';
  };

  ui.injectStyle = (id, css) => {
    let st = document.getElementById(id);
    if (!st) {
      st = el('style');
      st.id = id;
      (document.head || document.documentElement).appendChild(st);
    }
    if (st.textContent !== css) st.textContent = css;
    return st;
  };

  // ══ TOASTS (Coolhole page) ═══════════════════════════════════════
  const TOAST_CSS = `
#cq-toast{position:fixed;bottom:20px;right:20px;padding:11px 16px;border-radius:var(--cq-rad,8px);
  color:#fff;font:600 13px/1.4 var(--cq-font,system-ui,sans-serif);z-index:1000001;opacity:0;
  transform:translateY(12px) scale(.97);transition:opacity .28s ease,transform .28s ease;
  pointer-events:none;max-width:400px;border:1px solid var(--cq-tb,rgba(255,255,255,.1));
  box-shadow:var(--cq-tsh,0 4px 18px rgba(0,0,0,.4));text-transform:var(--cq-tt,none)}
#cq-toast.show{opacity:1;transform:none}
#cq-toast.cq-queue{background:var(--cq-tq,#c62828);color:var(--cq-tqfg,#fff);box-shadow:var(--cq-tqsh,0 0 0 0 transparent),var(--cq-tsh,0 4px 18px rgba(0,0,0,.4))}
#cq-toast.cq-qplus{background:var(--cq-tp,#0a5fad);color:var(--cq-tpfg,#fff);box-shadow:var(--cq-tpsh,0 0 0 0 transparent),var(--cq-tsh,0 4px 18px rgba(0,0,0,.4))}
#cq-toast.cq-final{filter:drop-shadow(0 0 10px rgba(30,136,229,.45))}
#cq-toast.cq-account{background:var(--cq-panel,#263238);color:var(--cq-panelfg,#eceff1);border-color:var(--cq-edge,#455a64)}
#cq-toast.cq-fail{background:var(--cq-tf,#141414);color:var(--cq-tffg,#ff8a80);border-color:var(--cq-tfb,#6b1212);
  box-shadow:var(--cq-tfsh,inset 3px 0 0 #c62828),var(--cq-tsh,0 4px 18px rgba(0,0,0,.4));animation:cq-shake .45s ease}
#cq-toast.cq-gold{background:var(--cq-tg,#c9a227);color:var(--cq-tgfg,#1a1200);background-size:200% 200%;
  animation:cq-gold-shine 1.8s ease-in-out infinite;border-color:rgba(255,224,130,.5);
  box-shadow:var(--cq-tgsh,0 0 0 0 transparent),var(--cq-tsh,0 4px 18px rgba(0,0,0,.4))}
#cq-toast.cq-gold-qplus{color:#1a0c00;background:linear-gradient(135deg,#bf360c,#ff8a65 35%,#e65100 70%,#bf360c);
  background-size:200% 200%;animation:cq-gold-shine 1.8s ease-in-out infinite;border-color:rgba(255,171,145,.45)}
@keyframes cq-gold-shine{0%{background-position:0 50%}50%{background-position:100% 50%}100%{background-position:0 50%}}
@keyframes cq-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@media (prefers-reduced-motion:reduce){#cq-toast,#cq-toast.cq-fail,#cq-toast.cq-gold,#cq-toast.cq-gold-qplus{animation:none;transition:opacity .15s ease}}
`;
  const TOAST_CLASSES = ['show', 'cq-fail', 'cq-gold', 'cq-gold-qplus', 'cq-qplus', 'cq-queue', 'cq-final', 'cq-account'];

  /**
   * kind: queue | qplus | qplus-posted | qplus-final | error | gold | gold-qplus | account
   * opts: { onClick, ms }
   */
  ui.toast = (msg, kind = 'queue', opts = {}) => {
    ui.injectStyle('cq-toast-css', TOAST_CSS);
    let t = document.getElementById('cq-toast');
    if (!t) {
      t = el('div');
      t.id = 'cq-toast';
      (document.body || document.documentElement).appendChild(t);
    }
    t.textContent = msg;
    t.classList.remove(...TOAST_CLASSES);
    t.style.pointerEvents = 'none';
    t.style.cursor = '';
    if (t._cqClick) { t.removeEventListener('click', t._cqClick); t._cqClick = null; }
    t.setAttribute('data-cq-theme', ui.themeId());
    t.setAttribute('data-cq-phase', ui.themeState.phase);

    const map = {
      account: ['cq-account'], qplus: ['cq-qplus'], 'qplus-posted': ['cq-qplus'],
      'qplus-final': ['cq-qplus', 'cq-final'], error: ['cq-fail'], 'gold-qplus': ['cq-gold-qplus'],
      gold: ['cq-gold'], queue: ['cq-queue'],
    };
    t.classList.add(...(map[kind] || map.queue));
    void t.offsetWidth;
    t.classList.add('show');
    if (opts.onClick) {
      t._cqClick = (e) => { e.preventDefault(); e.stopPropagation(); opts.onClick(t); };
      t.addEventListener('click', t._cqClick);
      t.style.pointerEvents = 'auto';
      t.style.cursor = 'pointer';
    }
    const long = ['error', 'qplus-final', 'gold', 'gold-qplus', 'account'].includes(kind);
    clearTimeout(t._cqTimer);
    t._cqTimer = setTimeout(() => {
      t.classList.remove(...TOAST_CLASSES);
      t.style.pointerEvents = 'none';
      if (t._cqClick) { t.removeEventListener('click', t._cqClick); t._cqClick = null; }
    }, opts.ms || (long ? 4800 : 3600));
    return t;
  };

  // ══ PILL ═════════════════════════════════════════════════════════
  const HOLD_MS = 450;
  const CH_LOCK_MS = 500;

  const PILL_CSS = `
:host{all:initial}
.cq-root{display:contents;font-family:var(--cq-font)}
.cq-pill{position:fixed;top:0;left:0;display:none;pointer-events:auto;height:24px;align-items:stretch;
  border-radius:var(--cq-radius);overflow:hidden;background:var(--cq-shell);box-shadow:var(--cq-shadow);
  line-height:1;user-select:none;white-space:nowrap;opacity:0;transform:scale(.86);z-index:999999;
  transition:opacity .14s ease,transform .14s ease;--cq-op:.38}
.cq-pill.cq-visible{opacity:var(--cq-op);transform:scale(1)}
.cq-pill.cq-visible.cq-hot{opacity:1}
.cq-seg{position:relative;overflow:hidden;border:0;margin:0;padding:0 9px;min-width:2.4em;height:24px;
  font:700 var(--cq-fontsize,10px)/1 var(--cq-font);letter-spacing:var(--cq-letterspacing,.05em);text-transform:var(--cq-tt);cursor:pointer;
  color:var(--cq-idlechfg);background:var(--cq-idlech);text-shadow:var(--cq-ts);text-align:center;
  appearance:none;-webkit-appearance:none;
  transition:color .15s ease,box-shadow .15s ease,filter .12s ease,transform .08s ease}
.cq-seg-cp{color:var(--cq-idlecpfg);background:var(--cq-idlecp)}
.cq-pill:not(.cq-colored) .cq-seg-ch{background:var(--cq-graych,#3a3a3a);color:var(--cq-graychfg,#c8c8c8);box-shadow:none;text-shadow:none}
.cq-pill:not(.cq-colored) .cq-seg-cp{background:var(--cq-graycp,#3a3a3a);color:var(--cq-graycpfg,#c8c8c8);box-shadow:none;text-shadow:none}
.cq-pill:not(.cq-colored) .cq-seg-ch:hover{background:var(--cq-chh);color:var(--cq-chhfg);box-shadow:var(--cq-chhsh);text-shadow:none}
.cq-pill:not(.cq-colored) .cq-seg-cp:hover{background:var(--cq-cph);color:var(--cq-cphfg);box-shadow:var(--cq-cphsh);text-shadow:none}
.cq-root[data-cq-theme="cobra"] .cq-pill:not(.cq-colored) .cq-seg-ch,
.cq-root[data-cq-theme="cobra"] .cq-pill:not(.cq-colored) .cq-seg-cp{
  background-color:#3a3a3a;background-image:none;color:#c8c8c8}
.cq-root[data-cq-theme="cobra"] .cq-pill:not(.cq-colored) .cq-seg-cp{box-shadow:inset 2px 0 0 rgba(57,255,20,.15)}
.cq-root[data-cq-theme="cobra"] .cq-pill:not(.cq-colored) .cq-seg-ch:hover{
  background-color:var(--cq-chh);background-image:none;color:var(--cq-chhfg)}
.cq-root[data-cq-theme="cobra"] .cq-pill:not(.cq-colored) .cq-seg-cp:hover{
  background-color:var(--cq-cph);background-image:none;color:var(--cq-cphfg)}
.cq-seg:active{transform:scale(.97)}
.cq-seg:focus-visible{outline:2px solid rgba(255,255,255,.75);outline-offset:-2px}
.cq-seg::before{content:'';position:absolute;inset:0;background-image:var(--cq-pattern);background-size:7px 7px;pointer-events:none}
.cq-seg::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:var(--cq-gloss);
  background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,0) 52%)}
.cq-seg>span{position:relative;z-index:1}
.cq-seg-ch{border-right:1px solid rgba(0,0,0,.25)}
.cq-pill.cq-single .cq-seg-cp{display:none}
.cq-pill.cq-single .cq-seg-ch{border-right:0}
.cq-seg-ch:hover{background:var(--cq-chh);color:var(--cq-chhfg);box-shadow:var(--cq-chhsh);text-shadow:none}
.cq-seg-cp:hover{background:var(--cq-cph);color:var(--cq-cphfg);box-shadow:var(--cq-cphsh);text-shadow:none}
.cq-pill.cq-colored .cq-seg-ch{background:var(--cq-ch);color:var(--cq-chfg);box-shadow:var(--cq-chsh);text-shadow:none}
.cq-pill.cq-colored .cq-seg-cp{background:var(--cq-cp);color:var(--cq-cpfg);box-shadow:var(--cq-cpsh);text-shadow:none}
.cq-pill.cq-colored .cq-seg-ch:hover{background:var(--cq-chh);color:var(--cq-chhfg);box-shadow:var(--cq-chhsh);filter:brightness(1.1)}
.cq-pill.cq-colored .cq-seg-cp:hover{background:var(--cq-cph);color:var(--cq-cphfg);box-shadow:var(--cq-cphsh);filter:brightness(1.1)}
.cq-seg.cq-sent{filter:brightness(1.25)}
.cq-seg-ch.cq-locked{pointer-events:none}
.cq-pill[data-support="no"] .cq-seg-ch>span::after{content:'*';opacity:.8}
.cq-fill{position:absolute;top:0;bottom:0;width:0;background:var(--cq-chfill,rgba(255,255,255,.3));pointer-events:none}
.cq-ch-fill{right:0}
.cq-cp-fill{left:0;background:var(--cq-cpfill,rgba(255,255,255,.18));transition:width .3s linear}
.cq-cp-hold{right:0;background:rgba(255,255,255,.22)}
.cq-seg-cp.cq-holding .cq-cp-hold{transition:width .45s linear;width:100%}
.cq-seg-cp.cq-ready .cq-cp-fill{width:100%;background:rgba(255,255,255,.08)}
.cq-pill.cq-gold,.cq-pill.cq-gold .cq-seg{box-shadow:0 2px 14px rgba(212,175,55,.55)}
.cq-pill.cq-gold .cq-seg-ch,.cq-pill.cq-gold .cq-seg-ch:hover{background:linear-gradient(180deg,#f0d77b,#c9a227 45%,#8a6a00);color:#1a1200;text-shadow:none}
.cq-pill.cq-gold .cq-seg-cp,.cq-pill.cq-gold .cq-seg-cp:hover{background:linear-gradient(180deg,#e8c547,#b8860b 50%,#6b5200);color:#1a1200;text-shadow:none}
.cq-pop{position:fixed;display:none;z-index:1000000;pointer-events:auto;width:240px;box-sizing:border-box;
  background:var(--cq-panel);color:var(--cq-panelfg);border:1px solid var(--cq-edge);border-radius:var(--cq-rad);
  font:12px/1.35 var(--cq-font);box-shadow:0 12px 40px rgba(0,0,0,.6);overflow:hidden}
.cq-pop-head{padding:8px 10px;font-weight:700;font-size:11px;letter-spacing:.04em;background:var(--cq-head);border-bottom:1px solid var(--cq-edge);text-transform:var(--cq-tt)}
.cq-pop-body{padding:8px 10px 10px;display:flex;flex-direction:column;gap:7px}
.cq-pop label{display:flex;align-items:center;gap:7px;cursor:pointer}
.cq-pop input[type=radio],.cq-pop input[type=checkbox]{margin:0;accent-color:var(--cq-cphs)}
.cq-pop input[type=datetime-local]{width:100%;box-sizing:border-box;padding:5px 6px;border-radius:4px;
  border:1px solid var(--cq-edge);background:rgba(0,0,0,.35);color:inherit;color-scheme:dark;font:12px var(--cq-font)}
.cq-pop-sep{height:1px;background:var(--cq-edge);opacity:.6}
.cq-pop-row{display:flex;gap:6px}
.cq-pop button{flex:1;border:0;border-radius:4px;padding:5px 10px;font:700 11px var(--cq-font);cursor:pointer;
  background:var(--cq-idlecp);color:var(--cq-idlecpfg);text-transform:var(--cq-tt)}
.cq-pop button:hover{background:var(--cq-cph);color:var(--cq-cphfg)}
.cq-pop button.cq-primary{background:var(--cq-ch);color:var(--cq-chfg)}
.cq-pop button.cq-primary:hover{background:var(--cq-chh);color:var(--cq-chhfg)}
`;

  ui.createPill = (h) => {
    const host = el('div');
    host.id = 'cq-pill-host';
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:999999;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = el('style');
    style.textContent = ui.themeCss() + PILL_CSS;
    shadow.appendChild(style);
    const root = el('div', 'cq-root');
    shadow.appendChild(root);

    const pill = el('div', 'cq-pill', null, { role: 'group' });
    const ch = el('button', 'cq-seg cq-seg-ch', null, { type: 'button' });
    const chFill = el('span', 'cq-fill cq-ch-fill');
    const chLabel = el('span', null, 'CH');
    ch.append(chFill, chLabel);
    const cp = el('button', 'cq-seg cq-seg-cp cq-ready', null, {
      type: 'button',
      title: 'Focus Coolhole and Work · hold for settings',
    });
    const cpFill = el('span', 'cq-fill cq-cp-fill');
    cpFill.style.width = '100%';
    const cpHold = el('span', 'cq-fill cq-cp-hold');
    cp.append(cpFill, cpHold, el('span', null, 'CP'));
    pill.append(ch, cp);

    // ── menu (CP hold) + schedule popover ──
    const menu = el('div', 'cq-pop');
    menu.append(el('div', 'cq-pop-head', 'CP Actions'));
    const mbody = el('div', 'cq-pop-body');
    const radios = {};
    [['work', 'Click CP to Work'], ['qplus', 'Click CP to queue to Q+'], ['schedule', 'Click CP to Schedule']].forEach(
      ([val, text]) => {
        const lab = el('label');
        const r = el('input', null, null, { type: 'radio', name: 'cq-cpmode', value: val });
        radios[val] = r;
        lab.append(r, document.createTextNode(text));
        mbody.append(lab);
        r.addEventListener('change', () => r.checked && CQ.settings.save({ cpMode: val }));
      }
    );
    mbody.append(el('div', 'cq-pop-sep'));
    const checks = {};
    [['unAfk', 'Un-AFK before Work'], ['autoFocus', 'Auto-focus Coolhole tab']].forEach(([k, text]) => {
      const lab = el('label');
      const c = el('input', null, null, { type: 'checkbox' });
      checks[k] = c;
      lab.append(c, document.createTextNode(text));
      mbody.append(lab);
      c.addEventListener('change', () => CQ.settings.save({ [k]: c.checked }));
    });
    const moreBtn = el('button', null, 'All settings…', { type: 'button' });
    moreBtn.addEventListener('click', () => { CQ.send({ type: 'cq:open-options' }); closeMenu(); });
    mbody.append(moreBtn);
    menu.append(mbody);

    const sched = el('div', 'cq-pop');
    sched.append(el('div', 'cq-pop-head', 'Schedule to Q+'));
    const sbody = el('div', 'cq-pop-body');
    const dt = el('input', null, null, { type: 'datetime-local' });
    const srow = el('div', 'cq-pop-row');
    const sGo = el('button', 'cq-primary', 'Schedule', { type: 'button' });
    const sClose = el('button', null, 'Close', { type: 'button' });
    srow.append(sGo, sClose);
    sbody.append(dt, srow);
    sched.append(sbody);
    root.append(pill, menu, sched);

    // ── state ──
    let ctx = null;
    let mode = 'ch';
    let menuOpen = false;
    let schedOpen = false;
    let hot = false;
    let chLockUntil = 0;
    let hideT = 0;
    let goldKey = null;
    let goldOn = false;

    const applySettings = () => {
      const s = CQ.settings.cur;
      root.setAttribute('data-cq-theme', ui.themeId(s));
      root.setAttribute('data-cq-phase', ui.themeState.phase);
      pill.style.setProperty('--cq-op', String(s.ytOpacity));
      pill.classList.toggle('cq-colored', s.grayButtons === false);
    };
    applySettings();
    CQ.settings.onChange(applySettings);
    ui.onTheme(applySettings);

    const place = (rect, where) => {
      pill.style.display = 'inline-flex';
      const pw = pill.offsetWidth || 72;
      const ph = pill.offsetHeight || 24;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left;
      let top;
      if (where === 'video-top-right') {
        left = Math.min(rect.right, vw) - pw - 8;
        top = Math.max(rect.top, 0) + 8;
      } else if (where === 'above') {
        left = rect.left + (rect.width - pw) / 2;
        top = rect.top - ph - 6;
      } else if (where === 'right') {
        left = rect.right + 6;
        top = rect.top + (rect.height - ph) / 2;
      } else {
        left = rect.right - pw;
        top = rect.bottom + 6;
        if (top + ph > vh - 4) top = rect.top - ph - 6;
      }
      pill.style.left = Math.max(4, Math.min(left, vw - pw - 4)) + 'px';
      pill.style.top = Math.max(4, Math.min(top, vh - ph - 4)) + 'px';
    };

    const rollGold = (key) => {
      if (key === goldKey) return;
      goldKey = key;
      goldOn = Math.random() < 0.03; // rare gold hover
      pill.classList.toggle('cq-gold', goldOn);
    };

    const api = {
      host,
      getContext: () => ctx,
      menuOpen: () => menuOpen || schedOpen,
      isHot: () => hot,
      setContext(c) { ctx = c; },
      setMode(m) {
        mode = m === 'un' ? 'un' : 'ch';
        chLabel.textContent = mode === 'un' ? 'UN' : 'CH';
        ch.title =
          mode === 'un'
            ? 'Remove from Coolhole queue / Q+'
            : 'Queue to Coolhole' +
              (ctx && ctx.supported === 'no' ? ' (site may not be playable on Coolhole)' : '');
        pill.dataset.support = ctx ? ctx.supported || '' : '';
      },
      show(rect, where, singleButton = false) {
        clearTimeout(hideT);
        applySettings();
        pill.classList.toggle('cq-single', singleButton);
        const wasHidden = !pill.classList.contains('cq-visible');
        place(rect, where);
        rollGold(ctx ? ctx.url : null);
        if (wasHidden) {
          void pill.offsetWidth;
          requestAnimationFrame(() => pill.classList.add('cq-visible'));
        }
      },
      hide(immediate) {
        if (menuOpen || schedOpen) return;
        if (!immediate && hot) return;
        clearTimeout(hideT);
        pill.classList.remove('cq-visible', 'cq-hot');
        hideT = setTimeout(() => {
          if (!pill.classList.contains('cq-visible')) pill.style.display = 'none';
        }, immediate ? 0 : 160);
      },
      closeAll() { closeMenu(); closeSched(); },
      openSchedule(anchorCtx) {
        if (anchorCtx) ctx = anchorCtx;
        const min = Date.now() + 30000;
        dt.min = toLocal(min);
        dt.value = toLocal(min);
        positionPop(sched);
        sched.style.display = 'block';
        schedOpen = true;
      },
    };

    const toLocal = (ts) => {
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    const positionPop = (pop) => {
      const r = pill.getBoundingClientRect();
      const w = 240;
      let left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
      let top = r.bottom + 6;
      if (top + 190 > window.innerHeight - 8) top = Math.max(8, r.top - 196);
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    };
    function closeMenu() { menu.style.display = 'none'; menuOpen = false; }
    function closeSched() { sched.style.display = 'none'; schedOpen = false; }
    const openMenu = () => {
      const s = CQ.settings.cur;
      Object.entries(radios).forEach(([k, r]) => (r.checked = s.cpMode === k));
      Object.entries(checks).forEach(([k, c]) => (c.checked = s[k] === true));
      positionPop(menu);
      menu.style.display = 'block';
      menuOpen = true;
    };

    sGo.addEventListener('click', () => {
      const ts = new Date(dt.value).getTime();
      if (!Number.isFinite(ts) || ts <= Date.now()) { dt.focus(); return; }
      closeSched();
      if (ctx) h.onSchedule(ctx, ts);
    });
    sClose.addEventListener('click', closeSched);
    document.addEventListener('mousedown', (e) => {
      if (!menuOpen && !schedOpen) return;
      if (e.target === host) return; // inside our shadow root
      closeMenu();
      closeSched();
    }, true);
    window.addEventListener('scroll', () => { if (menuOpen) closeMenu(); }, true);

    // ── hover bookkeeping ──
    pill.addEventListener('pointerenter', () => { hot = true; clearTimeout(hideT); pill.classList.add('cq-hot'); });
    pill.addEventListener('pointerleave', () => { hot = false; pill.classList.remove('cq-hot'); });

    // ── CH / UN ──
    const flashCh = () => {
      ch.classList.add('cq-sent', 'cq-locked');
      chFill.style.transition = 'none';
      chFill.style.width = '0%';
      void chFill.offsetWidth;
      chFill.style.transition = `width ${CH_LOCK_MS}ms linear`;
      chFill.style.width = '100%';
      setTimeout(() => {
        ch.classList.remove('cq-sent', 'cq-locked');
        chFill.style.transition = 'none';
        chFill.style.width = '0%';
      }, CH_LOCK_MS);
    };
    ch.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() < chLockUntil || !ctx) return;
      chLockUntil = Date.now() + CH_LOCK_MS;
      flashCh();
      if (mode === 'un') h.onUN(ctx);
      else h.onCH(ctx);
    });

    // ── CP: tap = action, hold = settings ──
    let holdTimer = 0;
    let holdOpened = false;
    let pressAt = 0;
    cp.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      pressAt = Date.now();
      holdOpened = false;
      cpHold.style.transition = `width ${HOLD_MS}ms linear`;
      cpHold.style.width = '0%';
      void cpHold.offsetWidth;
      cpHold.style.width = '100%';
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        holdOpened = true;
        cpHold.style.transition = 'none';
        cpHold.style.width = '0%';
        menuOpen ? closeMenu() : openMenu();
      }, HOLD_MS);
    });
    const endPress = () => {
      if (!pressAt) return;
      pressAt = 0;
      clearTimeout(holdTimer);
      cpHold.style.transition = 'none';
      cpHold.style.width = '0%';
      if (holdOpened) return;
      if (menuOpen) { closeMenu(); return; }
      h.onCP(ctx);
    };
    cp.addEventListener('pointerup', endPress);
    cp.addEventListener('pointercancel', () => { pressAt = 0; clearTimeout(holdTimer); });
    cp.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });

    // ── Work cooldown charge bar (written by the Coolhole tab) ──
    let cdTimer = 0;
    let cdEnds = 0;
    let cdTotal = 1000;
    const setReady = () => {
      cp.classList.add('cq-ready');
      cpFill.style.width = '100%';
      cp.title = 'Focus Coolhole and Work · hold for settings';
      clearInterval(cdTimer);
      cdTimer = 0;
    };
    const tickCd = () => {
      const rem = Math.max(0, cdEnds - Date.now());
      if (rem <= 0) return setReady();
      cp.classList.remove('cq-ready');
      cpFill.style.width = (((cdTotal - rem) / cdTotal) * 100).toFixed(1) + '%';
      cp.title = `Work cooldown — ${Math.ceil(rem / 1000)}s · hold for settings`;
    };
    const startCd = (state) => {
      if (!state || state.ready || !(state.remainingMs > 0)) { if (state && state.ready) setReady(); return; }
      cdTotal = Math.max(state.totalMs || 0, state.remainingMs, 1000);
      cdEnds = (state.startedAt || state.ts || Date.now()) + cdTotal;
      cpFill.style.width = '0%';
      tickCd();
      clearInterval(cdTimer);
      cdTimer = setInterval(tickCd, 250);
    };
    store.get(KEYS.workCd, null).then(startCd);
    store.watch(KEYS.workCd, startCd);

    (document.body || document.documentElement).appendChild(host);
    return api;
  };
})();
