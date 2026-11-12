
/* ================= UI-Grundlagen ================= */
const appEl = $('#app'), nav = $('#nav'), navL = $('#navL'), navT = $('#navT'), navR = $('#navR'), scroller = $('#scroll'), page = $('#page'), tabsEl = $('#tabs'), edbar = $('#edbar');
const TABS = ['day', 'week', 'prod', 'set'];
const ui = { tab: 'day', week: null, sub: [], showDone: false, scroll: {}, lastToday: today(), anim: '', dayAll: false, assign: null };
const ED = { on: false, sel: null, cut: null, dup: null };   // Bearbeiten-Modus der Woche
const A = {};
const stack = [];
const q = s => L(`„${s}“`, `“${s}”`);
const tile = (o, cls = '') => `<span class="tile ${cls} ${cc(o.color)}">${I(o.icon)}</span>`;

let toastT = null, toastUndo = null;
function toast(msg, undo){
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button data-a="_undo">${L('Rückgängig', 'Undo')}</button>` : ''}`;
  toastUndo = undo || null;
  el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => { el.classList.remove('on'); toastUndo = null; }, undo ? 5000 : 2600);
}
A._undo = () => { const u = toastUndo; toastUndo = null; $('#toast').classList.remove('on'); if (u) u(); };
function withUndo(msg, fn){
  const snap = JSON.stringify(D);
  if (fn() === false) return;
  save(); refreshAll();
  // Im Bearbeiten-Modus gibt es dafür die Knöpfe oben (ganzer Verlauf der Sitzung)
  toast(msg, ED.on ? null : () => keepView(() => { replaceData(migrate(JSON.parse(snap))); refreshAll(); }));
}

// Sheet: o.float = schwebende Glas-Karte (Details), sonst großes Sheet. Kopf: runde Glas-Knöpfe ✕ und ✓.
function sheet(o){
  $('#toast').classList.remove('on');
  const Ly = document.createElement('div');
  Ly.className = 'layer';
  const left = o.cancel !== false ? `<button class="gbtn glass" data-a="_left" aria-label="${o.float ? L('Schließen', 'Close') : L('Abbrechen', 'Cancel')}">${I('x')}</button>` : '';
  const right = o.onRight ? `<button class="gbtn glass tint" data-a="_right" aria-label="${esc(o.rightLabel || L('Sichern', 'Save'))}">${I('check')}</button>` : '';
  Ly.innerHTML = `<div class="sheet ${o.float ? 'float glass' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title || '')}"><div class="grab"></div><div class="sh"><div class="nl">${o.float ? '' : left}</div><div class="sht">${esc(o.title || '')}</div><div class="nr">${o.float ? left : right}</div></div><div class="sb"></div></div>`;
  const sh = Ly.firstElementChild, sb = $('.sb', Ly);
  const S = {
    el: Ly, sb, closed: false,
    set(html){ const st = sb.scrollTop; sb.innerHTML = html; sb.scrollTop = st; },
    close(){
      if (S.closed) return; S.closed = true;
      const ae = document.activeElement; if (ae && Ly.contains(ae)) ae.blur();
      Ly.classList.remove('in'); Ly.classList.add('out');
      const i = stack.indexOf(S); if (i >= 0) stack.splice(i, 1);
      setTimeout(() => { Ly.remove(); layerGone(); }, 460);
      o.onClose && o.onClose();
    },
    cancel(){ S.close(); }
  };
  Ly._on = { ...(o.on || {}), _left: () => S.cancel(), _right: () => o.onRight ? o.onRight(S) : S.close() };
  Ly.addEventListener('click', e => { if (e.target === Ly) S.cancel(); });
  if (o.onInput){
    Ly.addEventListener('input', e => { if (e.target.name) o.onInput(e.target.name, e.target.value, e.target, 'input'); });
    Ly.addEventListener('change', e => { if (e.target.name) o.onInput(e.target.name, e.target.value, e.target, 'change'); });
  }
  let y0 = null, dy = 0;
  const head = $('.sh', Ly);
  head.addEventListener('touchstart', e => { if (e.target.closest('button')) return; y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
  head.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  head.addEventListener('touchend', () => { if (y0 === null) return; y0 = null; sh.style.transition = ''; if (dy > 110){ sh.style.transform = 'translateY(110%)'; S.cancel(); } else sh.style.transform = ''; }, { passive: true });
  S.set(o.body || '');
  document.body.appendChild(Ly);
  stack.push(S);
  Ly.getBoundingClientRect();
  requestAnimationFrame(() => Ly.classList.add('in'));
  return S;
}
function closeSheets(){ for (const S of stack.slice().reverse()) S.close(); }
// Glas-Abfrage mit beliebig vielen Knöpfen (untereinander, wie bei iOS mit 3 Optionen)
function choose({ title, msg = '', buttons, vertical }){
  return new Promise(res => {
    const Ly = document.createElement('div');
    Ly.className = 'layer al';
    const v = vertical ?? buttons.length > 2;
    Ly.innerHTML = `<div class="alert glass" role="alertdialog"><div class="at">${esc(title)}</div>${msg ? `<div class="am">${esc(msg)}</div>` : ''}<div class="abt${v ? ' v' : ''}">${buttons.map((b, i) => `<button data-a="b" data-i="${i}" class="${b.cls || ''}">${esc(b.label)}</button>`).join('')}</div></div>`;
    let done = false;
    const fin = val => { if (done) return; done = true; Ly.classList.remove('in'); Ly.classList.add('out'); setTimeout(() => { Ly.remove(); layerGone(); }, 250); res(val); };
    Ly._on = { b: el => fin(buttons[+el.dataset.i].v) };
    document.body.appendChild(Ly); Ly.getBoundingClientRect();
    requestAnimationFrame(() => Ly.classList.add('in'));
  });
}
const ask = ({ title, msg = '', ok = L('OK', 'OK'), cancel = L('Abbrechen', 'Cancel'), danger = false }) =>
  choose({ title, msg, vertical: false, buttons: [{ label: cancel, v: false }, { label: ok, v: true, cls: danger ? 'd' : 'b' }] });
function menu(title, items){
  const Ly = document.createElement('div');
  Ly.className = 'layer as';
  Ly.innerHTML = `<div class="asw glass">${title ? `<div class="ash">${esc(title)}</div>` : ''}${items.map((it, i) => `<button class="${it.danger ? 'd' : ''}" data-a="i" data-i="${i}">${esc(it.label)}</button>`).join('')}<button class="asc" data-a="x">${L('Abbrechen', 'Cancel')}</button></div>`;
  let done = false;
  const close = () => { if (done) return false; done = true; Ly.classList.remove('in'); Ly.classList.add('out'); setTimeout(() => { Ly.remove(); layerGone(); }, 420); return true; };
  Ly._on = { i: el => { if (close()) items[+el.dataset.i].fn(); }, x: close };
  Ly.addEventListener('click', e => { if (e.target === Ly) close(); });
  document.body.appendChild(Ly); Ly.getBoundingClientRect();
  requestAnimationFrame(() => Ly.classList.add('in'));
}
// Glas-Kontextmenü wie bei iOS, an einem Element, einem Bereich (rect) oder einem Punkt ausgerichtet
function popMenu(o){
  const Ly = document.createElement('div');
  Ly.className = 'layer pl' + (o.dim ? ' dim' : '');
  const pv = o.preview, pr = pv && pv.r;
  Ly.innerHTML = (pr ? `<div class="pv ${pv.cls}" style="left:${pr.left}px;top:${pr.top}px;width:${pr.width}px;height:${pr.height}px">${pv.html}</div>` : '') + `<div class="pop" role="menu">${o.title ? `<div class="ph2">${esc(o.title)}</div>` : ''}${o.items.map((it, i) => it === '-' ? '<hr>' : `<button class="${it.danger ? 'd' : ''}" data-a="i" data-i="${i}" role="menuitem">${it.check !== undefined ? `<span class="ok" style="width:20px;display:flex">${it.check ? I('check') : ''}</span>` : ''}<span class="cg">${esc(it.label)}</span>${it.icon ? I(it.icon) : ''}</button>`).join('')}</div>`;
  document.body.appendChild(Ly);
  const pop = $('.pop', Ly), w = pop.offsetWidth, h = pop.offsetHeight, vw = innerWidth, vh = innerHeight;
  let x, y, ox = '50%', oy = 'top';
  if (o.anchor){ const a = o.anchor.getBoundingClientRect(); x = a.right - w; y = a.bottom + 6; ox = '100%'; if (y + h > vh - 16){ y = a.top - h - 6; oy = 'bottom'; } }
  else if (o.rect){
    const a = o.rect; x = a.left + a.width / 2 - w / 2;
    if (a.bottom + 12 + h <= vh - 16) y = a.bottom + 12;
    else if (a.top - 12 - h >= 16){ y = a.top - 12 - h; oy = 'bottom'; }
    else { y = (o.y ?? a.top + a.height / 2) - h / 2; oy = 'center'; }
  }
  else { x = o.x - w / 2; y = o.y + 18; if (y + h > vh - 24){ y = o.y - h - 18; oy = 'bottom'; } }
  x = clamp(x, 12, vw - w - 12); y = clamp(y, 12, Math.max(12, vh - h - 12));
  pop.style.left = x + 'px'; pop.style.top = y + 'px'; pop.style.transformOrigin = `${ox} ${oy}`;
  let done = false;
  const close = () => { if (done) return false; done = true; Ly.classList.remove('in'); Ly.classList.add('out'); setTimeout(() => { Ly.remove(); layerGone(); }, 260); o.onClose && o.onClose(); return true; };
  Ly._on = { i: el => { const it = o.items[+el.dataset.i]; if (close()) it.fn(); } };
  Ly.addEventListener('click', e => { if (e.target === Ly) close(); });
  Ly.getBoundingClientRect();
  requestAnimationFrame(() => Ly.classList.add('in'));
  return close;
}

/* ================= Darstellung & Sprache ================= */
const mqDark = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const t = D.set.theme, dark = t === 'dark' || (t === 'auto' && mqDark.matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  barColor(curBar);
}
// Farbe der Statusleiste: normal der Hintergrund, in der Heute-Ansicht die Farbe des laufenden Blockers
let curBar = null;
function barColor(c){
  curBar = c || null;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = c ? colHex(c, dark) : dark ? '#000000' : '#f2f2f7';
  $('#themeColor').setAttribute('content', bg);
  // iPhone-App: Hintergrund hinter der Statusleiste und helle oder dunkle Schrift darin passend setzen
  if (NATIVE) post('bar', { bg, light: c ? lum(bg) <= .45 : dark, theme: D.set.theme });
}
function colHex(c, dark){ if (!colorOk(c)) c = 'blue'; if (c[0] === '#') return dark ? mixW(c.toLowerCase(), .12) : c.toLowerCase(); const x = COLORS.find(y => y[0] === c); return dark ? x[2] : x[1]; }
try { mqDark.addEventListener('change', () => { if (D.set.theme === 'auto'){ applyTheme(); render(); } }); } catch (e) {}
function renderTabs(){
  const T = [['day', 'tabToday', L('Heute', 'Today')], ['week', 'tabWeek', L('Woche', 'Week')], ['prod', 'tabProd', 'Productivity'], ['set', 'tabSet', L('Einstellungen', 'Settings')]];
  tabsEl.querySelectorAll('button').forEach(b => b.remove());
  tabsEl.insertAdjacentHTML('beforeend', T.map(([t, ic, l]) => `<button data-a="tab" data-t="${t}">${I(ic)}<span>${l}</span></button>`).join(''));
}
function applyLang(){ LANG = D.set.lang === 'auto' ? sysLang() : D.set.lang; document.documentElement.lang = LANG; OCC.clear(); renderTabs(); }

/* ================= Fehlerprotokoll ================= */
// Fehler landen in einem kleinen Protokoll (Einstellungen → Über Schedule), statt eine Ansicht leer zu lassen
const LOGK = 'sp.log';
function logErr(where, e){
  try {
    const l = errLog();
    l.push({ t: Date.now(), w: String(where).slice(0, 40), m: String((e && e.message) || e).slice(0, 200), s: String((e && e.stack) || '').split('\n').slice(0, 3).join(' | ').slice(0, 300), v: APP_VERSION });
    localStorage.setItem(LOGK, JSON.stringify(l.slice(-20)));
  } catch (_) {}
}
function errLog(){ try { const l = JSON.parse(localStorage.getItem(LOGK) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
window.addEventListener('error', e => logErr('error', e.error || e.message));
window.addEventListener('unhandledrejection', e => logErr('promise', e.reason));

/* ================= Rendering ================= */
const VIEWS = {};
// Eine Ansicht, die nicht gebaut werden kann, zeigt einen Hinweis statt einer leeren Seite
function viewOf(tab){
  try {
    const v = VIEWS[tab]();
    if (!v || typeof v.body !== 'string' || !v.body) throw new Error('Ansicht ohne Inhalt');
    return v;
  } catch (e){
    logErr('view ' + tab, e);
    return { title: APP, navAlways: true, body: `<div class="empty"><b>${L('Diese Ansicht ließ sich gerade nicht laden.', 'This view could not be loaded.')}</b>${L('Deine Daten sind sicher.', 'Your data is safe.')}<br><br><button class="gpill sm glass" data-a="reload">${L('Neu laden', 'Reload')}</button></div>` };
  }
}
A.reload = () => { if (!post('reload')) location.reload(); };
let shown = '', animT = 0;   // shown = zuletzt gezeichnete Ansicht (Kopf + Inhalt), für sanfte Updates
const headOf = v => [v.title, v.left, v.right, v.bar, v.cls, v.app, v.navAlways ? 1 : 0].join('\u0001');
function render(){
  const v = viewOf(ui.tab);
  navL.innerHTML = v.left || ''; navR.innerHTML = v.right || ''; navT.textContent = v.title || '';
  nav.classList.toggle('always', !!v.navAlways);
  appEl.className = v.app || '';
  if ((v.bc || null) !== curBar) barColor(v.bc);
  page.className = 'page ' + (v.cls || '') + (ui.anim ? ' ' + ui.anim : '');
  if (ui.anim){ clearTimeout(animT); animT = setTimeout(() => page.classList.remove('push', 'pop'), 450); }
  ui.anim = '';
  page.style.display = '';
  page.innerHTML = v.body;
  edbar.innerHTML = v.bar || '';
  shown = headOf(v) + '\u0002' + v.body;
  const idx = TABS.indexOf(ui.tab);
  for (const b of tabsEl.querySelectorAll('button')) b.classList.toggle('on', b.dataset.t === ui.tab);
  $('#lens').style.transform = `translateX(${idx * 100}%)`;
  onScroll(); afterRender();
}
// Nach jedem Zeichnen: Live-Anzeigen (Countdown) sofort auf den richtigen Stand bringen
function afterRender(){ try { if (typeof focusTick === 'function') focusTick(); } catch (e) { logErr('afterRender', e); } }
// Für Uhrzeit-Updates: nur die geänderten Teile austauschen statt die ganze Seite neu aufzubauen.
// Ein kompletter Neuaufbau während des Scrollens kann auf dem iPhone eine leere Fläche hinterlassen.
function softRender(){
  const v = viewOf(ui.tab), head = headOf(v);
  if (head + '\u0002' + v.body === shown) return;
  if (head !== shown.split('\u0002')[0] || !page.firstElementChild){ render(); return; }
  morph(page, v.body);
  shown = head + '\u0002' + v.body;
  afterRender();
}
function morph(el, html){ const t = document.createElement('template'); t.innerHTML = html; syncKids(el, t.content); }
function syncKids(a, b){
  const an = [...a.childNodes], bn = [...b.childNodes];
  for (let i = 0; i < Math.max(an.length, bn.length); i++){
    const x = an[i], y = bn[i];
    if (!x){ a.appendChild(y); continue; }
    if (!y){ a.removeChild(x); continue; }
    if (x.isEqualNode(y)) continue;
    if (x.nodeType === 3 && y.nodeType === 3){ x.nodeValue = y.nodeValue; continue; }
    if (x.nodeType !== 1 || x.nodeName !== y.nodeName || x.namespaceURI !== y.namespaceURI || /^(INPUT|TEXTAREA|SELECT)$/.test(x.nodeName)){ a.replaceChild(y, x); continue; }
    for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
    for (const at of y.attributes) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
    syncKids(x, y);
  }
}
// Holt Inhalte zurück, die iOS nach dem Aufwachen oder nach Überlagerungen nicht neu gezeichnet hat.
// Früher wurde die Seite dafür kurz ausgeblendet (display:none). Das ließ beim Schließen von Übersichten
// und beim Zurückgehen kurz eine weiße Fläche aufblitzen. Jetzt wird nur die Ebene neu zusammengesetzt,
// der Inhalt bleibt dabei die ganze Zeit sichtbar.
let healR = 0;
function heal(){
  const ae = document.activeElement;
  if (document.hidden || (ae && page.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) return;
  if (!page.firstElementChild){ render(); return; }
  page.style.display = '';
  page.classList.add('heal');
  cancelAnimationFrame(healR);
  healR = requestAnimationFrame(() => requestAnimationFrame(() => page.classList.remove('heal')));
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  if (scroller.scrollTop > max) scroller.scrollTop = max;
  onScroll();
}
// Nutzt gerade jemand den Bildschirm (Finger drauf oder die Seite gleitet noch nach)? Dann kurz warten.
// Scrollen zählt nur kurz nach einer Berührung, Scrollen durch die App selbst nicht.
let lastScrollAt = 0, touchAt = 0, touches = 0;
const busy = () => (touches > 0 && Date.now() - touchAt < 8000) || (Date.now() - lastScrollAt < 1200 && Date.now() - touchAt < 5000);
for (const ev of ['touchstart', 'touchend', 'touchcancel']) document.addEventListener(ev, e => { touches = e.touches.length; touchAt = Date.now(); }, { passive: true, capture: true });
function layerGone(){ setTimeout(() => { if (!document.querySelector('.layer, .tut') && !G && !busy()) heal(); }, 30); }
function refreshAll(){ render(); for (const s of stack.slice()) if (s.refresh && !s.closed) s.refresh(); }
function onScroll(){ const y = scroller.scrollTop; nav.classList.toggle('sc', y > 4); nav.classList.toggle('st', y > 40); }
scroller.addEventListener('scroll', () => { lastScrollAt = Date.now(); onScroll(); }, { passive: true });
function switchTab(t){
  if (ED.on && t !== 'week') edExit(false);
  if (ui.assign && t !== 'week') ui.assign = null;
  if (t === ui.tab){
    if (t === 'day' && ui.dayAll){ dayMode(false); return; }
    if (t === 'set' && ui.sub.length){ ui.sub = []; subGo(-1); return; }
    if (t === 'week' && ui.week !== wkStart(today())){ ui.week = wkStart(today()); render(); scrollWeekToNow(); return; }
    // Aktiven Tab noch einmal antippen: Ansicht frisch aufbauen und nach oben
    render(); heal();
    scroller.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  ui.scroll[ui.tab] = scroller.scrollTop;
  ui.tab = t;
  render();
  if (t === 'week' && ui.scroll.week === undefined) scrollWeekToNow();
  else scroller.scrollTop = ui.scroll[t] || 0;
  onScroll();
}
A.tab = el => switchTab(el.dataset.t);
A.go = el => { ui.sub.push(el.dataset.p); subGo(1); };
A.back = () => { ui.sub.pop(); subGo(-1); };
// Unterseiten öffnen und zurück: erst nach oben, dann neu zeichnen, dann sanft hereingleiten.
// Nur transform/opacity per Web Animations API: Bleibt sie hängen, ist der Inhalt trotzdem sichtbar.
function subGo(dir){
  scroller.scrollTop = 0; ui.anim = ''; render(); onScroll();
  slideIn(dir);
}
function slideIn(dir){
  if (!page.animate || document.hidden) return;
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  page.animate([{ transform: `translate3d(${dir * 28}px,0,0)`, opacity: .55 }, { transform: 'translate3d(0,0,0)', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,.9,.3,1)' });
}
const backBtn = () => `<button class="gbtn glass" data-a="back" aria-label="${L('Zurück', 'Back')}">${I('chevL')}</button>`;
