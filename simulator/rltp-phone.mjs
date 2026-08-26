// rltp-phone — the shared phone chrome of the RLTP simulators.
//
// THIRD SHARED BUILDING BLOCK (beside rltp-core, the form layer, and
// rltp-crypto, the crypto layer): ONE source for the app's look — shell,
// status bar, tab bar, contact rows with the badge grammar, profile
// heads, the in-phone one-way-door bottom sheet, and the device wallet.
// Anton's direction: the simulators must never drift apart in UX and
// will eventually merge into one total simulator — so the chrome lives
// here exactly once.
//
// Color grammar (established): BLUE .mutual = verification · GREEN
// .trustb = trust · AMBER .byme = one-sided/unverified. The phone is
// deliberately a light "app" surface inside whatever page theme; wallet
// classes use the page's CSS variables (--border/--muted/--card/--tint).
//
// Consumers: network.html (string builders + CSS) · graph.html (CSS;
// its imperative DOM code keeps the same class names) · index.html
// (ceremony sim) still carries its own older phone design — migrating
// it onto this chrome is named follow-up work toward the total
// simulator.

export const PHONE_CSS = `
  .phone-shell { background: oklch(12% 0.01 265); border-radius: 24px; padding: 6px;
    box-shadow: 0 18px 40px -16px rgba(0,0,0,.7); }
  .phone-screen { background: oklch(98% 0.003 265); color: oklch(22% 0.004 265);
    border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; height: 470px; position: relative; }
  .phone-screen.off::after { content: '✈ offline'; position: absolute; top: 7px; right: 12px;
    font-size: 9px; font-weight: 700; color: oklch(60% 0.14 60); }
  .phone-status { display: flex; align-items: center; justify-content: space-between;
    padding: 7px 14px 2px; font-size: 10px; font-family: ui-monospace, monospace; color: oklch(44% 0.008 265); }
  .phone-body { flex: 1; overflow: auto; padding: 8px 12px 12px; }
  .phone-apphead { display: flex; align-items: center; gap: 7px; padding: 2px 2px 8px; }
  .pavatar-xs { width: 22px; height: 22px; border-radius: 50%; color: #fff; flex: none;
    display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
  .appname { font-size: 13.5px; font-weight: 700; }
  .backbtn { font: inherit; font-size: 11px; font-weight: 700; border: none; background: transparent;
    color: oklch(55% 0.21 264); cursor: pointer; padding: 0 2px 0 0; }
  .pbar { display: flex; border-top: 1px solid oklch(92% 0.005 265); background: #fff; flex: none; }
  .pbtn { flex: 1; font: inherit; font-size: 9.5px; font-weight: 600; padding: 5px 0 7px; cursor: pointer;
    border: none; background: transparent; color: oklch(52% 0.008 265);
    display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .pbtn .ico { width: 17px; height: 17px; display: block; }
  .pbtn.active { color: oklch(55% 0.21 264); }
  .plist { background: #fff; border: 1px solid oklch(92% 0.005 265); border-radius: 12px; overflow: hidden; }
  .prow { display: flex; align-items: center; gap: 8px; padding: 7px 10px; font-size: 12.5px;
    border-top: 1px solid oklch(94% 0.004 265); }
  .prow:first-child { border-top: none; }
  button.prow { cursor: pointer; width: 100%; border-left: none; border-right: none; border-bottom: none;
    background: transparent; font-family: inherit; text-align: left; color: inherit; padding: 8px 10px; }
  .prow .pdot { width: 11px; height: 11px; border-radius: 50%; flex: none; background: oklch(88% 0.005 265); }
  .prow .plabel { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .prow .psub { display: block; font-size: 10.5px; font-weight: 400; color: oklch(48% 0.008 265); }
  .prow .pavatar-s { width: 30px; height: 30px; border-radius: 50%; flex: none;
    display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; }
  .prow .pnamerow { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .prow .pname2 { font-weight: 700; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .prow .pmeta { display: block; font-size: 10.5px; font-weight: 400; color: oklch(48% 0.008 265); margin-top: 2px; }
  .pbadge { font-size: 9.5px; font-weight: 600; padding: 1.5px 7px; border-radius: 99px; flex: none; }
  .pbadge.mutual { background: oklch(93% 0.05 264); color: oklch(45% 0.16 264); }
  .pbadge.byme { background: oklch(96% 0.06 85); color: oklch(50% 0.12 70); }
  .pbadge.trustb { background: oklch(94% 0.06 142); color: oklch(42% 0.14 142); }
  .sharebtn { font-size: .66rem; font-weight: 700; padding: 4px 10px; border-radius: 8px; flex: none; cursor: pointer;
    border: 1.5px solid oklch(52% 0.14 145); color: oklch(46% 0.14 145); background: transparent; }
  .subctl { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex: none; font-size: .6rem; color: oklch(48% 0.008 265); }
  .plink { font-size: .62rem; color: oklch(46% 0.14 145); background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline; }
  .profhead { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 10px 0 14px; }
  .profhead .pavatar { width: 54px; height: 54px; border-radius: 50%; color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
  .profhead .pname { font-size: 16px; font-weight: 700; }
  .profhead .psub2 { font-size: 10.5px; color: oklch(44% 0.008 265); text-align: center; }
  .profact { display: flex; flex-direction: column; gap: 7px; margin-top: 10px; }
  .profact button { font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; padding: 9px 12px;
    border-radius: 11px; border: 1px solid oklch(88% 0.005 265); background: #fff; color: oklch(30% 0.006 265);
    display: flex; align-items: center; gap: 8px; }
  .profact button.primary { background: oklch(55% 0.21 264); border-color: transparent; color: #fff; }
  .profmeta { margin-top: 12px; font-family: ui-monospace, monospace; font-size: 9.5px; color: oklch(48% 0.008 265);
    word-break: break-all; line-height: 1.5; }
  .pempty { font-size: 12px; color: oklch(48% 0.008 265); padding: 12px; text-align: center; }
  .pfoot { font-size: 9.5px; color: oklch(52% 0.008 265); padding: 7px 10px 8px; text-wrap: pretty; }
  #phdlg, .phdlg { position: absolute; inset: 0; background: oklch(25% 0.01 265 / .42); display: flex; align-items: flex-end; z-index: 5; }
  #phdlg[hidden], .phdlg[hidden] { display: none; }
  .phdlg-card { background: #fff; width: 100%; border-radius: 16px 16px 0 0; padding: 13px 14px 14px;
    display: flex; flex-direction: column; gap: 8px; box-shadow: 0 -8px 28px rgba(0,0,0,.22); }
  .phdlg-card h4 { margin: 0; font-size: 13px; }
  .phdlg-card p { margin: 0; font-size: 11px; line-height: 1.45; }
  .phdlg-card p.note, .phdlg-card p { color: oklch(48% 0.008 265); }
  .phdlg-card input { font: inherit; font-size: 12px; padding: 6px 8px; border-radius: 8px;
    border: 1px solid oklch(88% 0.005 265); width: 100%; }
  .phdlg-btns { display: flex; gap: 7px; justify-content: flex-end; margin-top: 2px; }
  .phdlg-btns button { font: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer;
    padding: 5px 13px; border-radius: 9px; border: 1px solid oklch(88% 0.005 265); background: transparent; color: oklch(40% 0.008 265); }
  .phdlg-btns button.primary { background: oklch(52% 0.14 145); border-color: transparent; color: #fff; }
  .phdlg-btns button.primary.blue { background: oklch(55% 0.21 264); }
  /* 🗂 device wallet (page-theme aware via CSS variables) */
  .whead { font-size: .62rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: var(--muted); margin: .2rem 0 .35rem; padding-left: .2rem; }
  .wfilter { display: flex; gap: 6px; margin: 6px 0 8px; }
  .wchip { font: inherit; font-size: .62rem; font-weight: 700; padding: 3px 10px; border-radius: 99px;
    border: 1.5px solid var(--border); background: var(--card); color: var(--muted); cursor: pointer; }
  .wchip.active { border-color: var(--primary); color: var(--primary); background: var(--primary-tint); }
  .wcat { border: 1px solid var(--border); border-radius: .6rem; margin-bottom: .45rem; overflow: hidden;
    background: var(--card); }
  .wcat > button { width: 100%; display: flex; align-items: baseline; justify-content: space-between; gap: .5rem;
    padding: .5rem .7rem; border: none; background: transparent; color: var(--fg);
    font: inherit; font-size: .78rem; font-weight: 700; cursor: pointer; text-align: left; }
  .wcat .wfpp { font-size: .62rem; font-weight: 400; color: var(--muted); }
  .wcat .wbadge { font-family: ui-monospace, monospace; font-size: .68rem; color: var(--muted); flex: none; }
  .witems { padding: 0 .7rem .55rem; display: flex; flex-direction: column; gap: .5rem; }
  .witem { border-top: 1px solid var(--border); padding-top: .45rem; }
  .witem .wtitle { font-size: .74rem; font-weight: 600; }
  .witem .wsub { font-family: ui-monospace, monospace; font-size: .63rem; color: var(--muted); margin: 2px 0 4px; }
  .witem pre { font-family: ui-monospace, monospace; font-size: .62rem; line-height: 1.5; background: var(--tint);
    border-radius: .4rem; padding: .45rem .55rem; max-height: 220px; overflow: auto;
    white-space: pre-wrap; word-break: break-all; margin: 0; }
  .wempty { font-size: .68rem; color: var(--muted); padding: .2rem 0 .35rem; }
`

export function injectPhoneCss (doc = globalThis.document) {
  if (doc.getElementById('rltp-phone-css')) return
  const el = doc.createElement('style')
  el.id = 'rltp-phone-css'
  el.textContent = PHONE_CSS
  doc.head.appendChild(el)
}

// ── icons (tab bar) ─────────────────────────────────────────────────────
const SVG = (paths) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
export const ICONS = {
  home: SVG('<path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>'),
  contacts: SVG('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  groups: SVG('<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>'),
  profile: SVG('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
}

// ── string builders (network.html-style rendering) ──────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

export const avatarXs = (name, color) => `<span class="pavatar-xs" style="background:${color}">${esc(name[0])}</span>`
export const avatarS = (name, color) => `<span class="pavatar-s" style="background:${color}33;color:${color}">${esc(name.slice(0, 2).toUpperCase())}</span>`
export const badge = (type, text) => `<span class="pbadge ${type}">${esc(text)}</span>`

export const appHead = (name, color, extra = '') => `<div class="phone-apphead">${avatarXs(name, color)}<span class="appname">${esc(name)}</span>${extra}</div>`
export const backHead = (label, onclick, right = '') => `<div class="phone-apphead"><button class="backbtn" onclick="${onclick}">‹ ${esc(label)}</button>${right ? `<span class="appname" style="margin-left:auto">${esc(right)}</span>` : ''}</div>`

// contact row: tinted avatar · pnamerow(name + badges) · pmeta — the
// graph app's row, as a string
export const contactRow = ({ name, color, badges = '', meta = '', onclick }) => `
  <${onclick ? 'button' : 'div'} class="prow"${onclick ? ` onclick="${onclick}"` : ''}>${avatarS(name, color)}
    <span class="plabel"><span class="pnamerow"><span class="pname2">${esc(name)}</span>${badges}</span>
    ${meta ? `<span class="pmeta">${esc(meta)}</span>` : ''}</span></${onclick ? 'button' : 'div'}>`

export const profHead = ({ name, color, sub = '' }) => `
  <div class="profhead"><span class="pavatar" style="background:${color}">${esc(name[0])}</span>
    <div class="pname">${esc(name)}</div><div class="psub2">${sub}</div></div>`

export const tabBar = (tabs, active, onTab) => `<div class="pbar">${tabs.map(([key, label]) =>
  `<button class="pbtn ${active === key ? 'active' : ''}" onclick="${onTab(key)}">${ICONS[key] ?? ''}${esc(label)}</button>`).join('')}</div>`

export const bottomSheet = (inner) => `<div class="phdlg"><div class="phdlg-card">${inner}</div></div>`

// the full phone: label row above (owner + controls), shell, status bar
// (app name centered, OWNER top right — Anton's rule), body, tab bar
export const phoneShell = ({ owner, color, clock, app = 'Web of Trust', online = true, body, tabs = '', sheet = '', labelExtra = '' }) => `
  <div class="devlabel">${esc(owner)}${labelExtra}</div>
  <div class="phone-shell"><div class="phone-screen ${online ? '' : 'off'}">
    <div class="phone-status"><span>${esc(clock)}</span><span>${esc(app)}</span><span>${esc(owner)}</span></div>
    <div class="phone-body">${body}</div>
    ${tabs}
    ${sheet}
  </div></div>`

// 🗂 device wallet — categories with counts, All/Sent/Received chips
export const walletHtml = ({ cats, dir = 'all', open = {}, onDir, onCat }) => {
  const chips = [['all', 'All'], ['out', '📤 Sent'], ['in', '📥 Received']]
    .map(([k, l]) => `<button class="wchip ${dir === k ? 'active' : ''}" onclick="${onDir(k)}">${l}</button>`).join('')
  const boxes = cats.map((c) => {
    let items = c.items
    if (dir !== 'all') { items = items.filter((it) => it.dir === dir); if (!items.length) return '' }
    const body = open[c.key] ? `<div class="witems">${items.length ? items.map((it) => `
      <div class="witem"><div class="wtitle">${esc(it.title)}</div><div class="wsub">${esc(it.sub)}</div><pre>${it.json.replace(/</g, '&lt;')}</pre></div>`).join('') : '<div class="wempty">empty</div>'}</div>` : ''
    return `<div class="wcat"><button onclick="${onCat(c.key)}"><span>${esc(c.title)}<br><span class="wfpp">${esc(c.fpp)}</span></span><span class="wbadge">${items.length}</span></button>${body}</div>`
  }).join('')
  return `<div class="wallet"><div class="whead">🗂 Stored on this device</div><div class="wfilter">${chips}</div>${boxes}</div>`
}
