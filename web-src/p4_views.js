
/* ---------- Heute (nur der heutige Tag, als Zeitstrahl) ---------- */
// To-Dos eines Termins: erst die wiederkehrenden (mit Änderungen nur für diesen Tag), dann die einmaligen nach Priorität
function todoItems(o){
  const ov = D.rto[o.date] && D.rto[o.date][o.id], out = [];
  for (const r of (o.rt || [])){
    const x = ov && ov[r.id]; if (x && x.x) continue;
    out.push({ kind: 'r', id: r.id, title: x && x.t ? x.t : r.title, base: r.title, ch: !!(x && x.t), done: rtDone(o.date, o.id, r.id), prio: 0 });
  }
  const ts = todosAt(o.date, o.id).sort((a, b) => (b.prio || 0) - (a.prio || 0) || a.created - b.created);
  for (const t of ts) out.push({ kind: 't', id: t.id, title: t.title, done: t.done, prio: t.prio || 0 });
  return out;
}
// Heute: Vollbild in der Farbe des laufenden Blockers mit Countdown und seinen To-Dos.
// Doppelt tippen zeigt den ganzen Tag, dort bleibt der aktuelle Blocker oben angeheftet.
const atMs = (k, m) => { const d = pd(k); d.setHours(0, 0, 0, 0); return d.getTime() + m * 60000; };
function dayNow(k, n){
  const live = occ(k).filter(o => !o.skipped);
  return { live, cur: live.filter(o => tmin(o.start) <= n && n < tmin(o.end)).pop() || null, nxt: live.find(o => tmin(o.start) > n) || null, prev: live.filter(o => tmin(o.end) <= n).pop() || null };
}
const WELCOME = () => `<h1 class="lt">${L('Heute', 'Today')}</h1><div class="lts">${fD(today(), { wd: 'long', long: true })}</div><div class="welcome glass"><span class="tile xl c-blue">${I('calendar')}</span><h2>${L('Deine Master-Woche', 'Your master week')}</h2><p>${L('Trag einmal ein, wann du was machst, zum Beispiel Arbeit, Schule oder Sport. Hier siehst du dann jeden Tag deinen Zeitstrahl.', 'Enter once when you do what, for example work, school or sport. This is where you then see your timeline every day.')}</p><button class="abtn tint" data-a="startSetup">${L('Master-Woche einrichten', 'Set up master week')}</button><button class="abtn soft" data-a="sample">${L('Mit Beispielwoche starten', 'Start with a sample week')}</button></div>`;
const editBtn = () => `<button class="gbtn glass" data-a="editToday" aria-label="${L('Woche bearbeiten', 'Edit week')}">${I('pencil')}</button>`;
VIEWS.day = () => {
  const k = today(), n = nowMin();
  if (!D.slots.length && !occ(k).length) return { title: L('Heute', 'Today'), body: WELCOME() };
  const st = dayNow(k, n);
  return ui.dayAll ? dayAll(k, n, st) : dayFocus(k, n, st);
};
const RING_C = 666.0;   // Umfang des Rings (r = 106)
function dayFocus(k, n, st){
  const { cur, nxt, live, prev } = st, f = cur || nxt;
  let h, color, s0 = 0, e0 = 0, lab = '', sub = '';
  if (f){
    color = f.color;
    if (cur){ s0 = atMs(k, tmin(cur.start)); e0 = atMs(k, tmin(cur.end)); lab = L('noch', 'left'); sub = L(`bis ${fT(cur.end)}`, `until ${fT(cur.end)}`); }
    else { const from = prev ? tmin(prev.end) : n >= dayS() ? Math.min(dayS(), tmin(nxt.start)) : 0; s0 = atMs(k, from); e0 = atMs(k, tmin(nxt.start)); lab = L('beginnt in', 'starts in'); sub = L(`um ${fT(nxt.start)}`, `at ${fT(nxt.start)}`); }
    const after = cur ? nxt : null, items = todoItems(f), open = items.filter(x => !x.done).length;
    const now = Date.now(), fr = e0 > s0 ? clamp((now - s0) / (e0 - s0), 0, 1) : 1;
    h = `<div class="fcs" data-mode="${cur ? 'now' : 'next'}"><div class="fk">${cur ? L('Jetzt', 'Now') : L('Als Nächstes', 'Up next')} · ${fR(f.start, f.end)}</div>`
      + `<h1 class="ft">${I(f.icon)}<span>${esc(f.title)}</span></h1>`
      + `<div class="fring" data-s="${s0}" data-e="${e0}"><div class="fglow"></div><svg viewBox="0 0 240 240" aria-hidden="true"><circle class="tr" cx="120" cy="120" r="106"/><circle class="pg" cx="120" cy="120" r="106" stroke-dasharray="${RING_C}" style="stroke-dashoffset:${(RING_C * fr).toFixed(2)}"/></svg><div class="fhd" style="transform:rotate(${((1 - fr) * 360).toFixed(2)}deg)"><i></i></div>`
      + `<div class="fc"><div class="fcl">${lab}</div><div class="fcd">${fmtLeft(e0 - Date.now())}</div><div class="fcu">${sub}</div></div></div>`
      + (after ? `<div class="fnx">${L('Danach', 'Next')}: ${esc(after.title)} · ${fT(after.start)}</div>` : !cur && f ? '' : `<div class="fnx">${L('Danach ist für heute Schluss', 'Last block today')}</div>`)
      + `<div class="ftd"><div class="fth"><span>${cur ? 'To-Dos' : L(`To-Dos für ${esc(f.title)}`, `To-dos for ${esc(f.title)}`)}</span>${items.length ? `<span>${open ? L(`${open} offen`, `${open} open`) : L('alles erledigt', 'all done')}</span>` : ''}</div>`
      + items.map(it => `<button class="fti${it.done ? ' dn' : ''}" data-a="tlTodo" data-k="${it.kind}" data-d="${k}" data-o="${esc(f.id)}" data-id="${esc(it.id)}"><span class="bx">${I('check')}</span>${prioMark(it.prio)}<span class="tx">${esc(it.title)}</span>${it.kind === 'r' ? I('repeat', 'rp') : ''}</button>`).join('')
      + `<button class="fadd" data-a="fAdd" data-d="${k}" data-o="${esc(f.id)}">${I('plus')}<span>${L('To-Do hinzufügen', 'Add to-do')}</span></button></div>`
      + `<button class="fhint" data-a="dayAll">${I('list')}<span>${L('Doppelt tippen für den ganzen Tag', 'Double-tap for the whole day')}</span></button></div>`;
  } else {
    const tm = occ(addD(k, 1)).filter(o => !o.skipped)[0];
    color = live.length ? 'green' : 'teal';
    h = `<div class="fcs" data-mode="off"><div class="fk">${fD(k, { wd: 'long', long: true })}</div><h1 class="ft">${I(live.length ? 'moon' : 'leaf')}<span>${live.length ? L('Feierabend', 'All done') : L('Heute ist frei', 'Today is free')}</span></h1>`
      + `<div class="fring off"><div class="fglow"></div><svg viewBox="0 0 240 240" aria-hidden="true"><circle class="tr" cx="120" cy="120" r="106"/><circle class="pg" cx="120" cy="120" r="106" stroke-dasharray="${RING_C}" style="stroke-dashoffset:0"/></svg><div class="fc"><div class="fcd sm">${live.length ? L(`${live.length} Blocker`, `${live.length} blocks`) : I('check')}</div><div class="fcu">${live.length ? L('heute geschafft', 'done today') : L('Nichts geplant', 'Nothing planned')}</div></div></div>`
      + (tm ? `<div class="fnx">${L('Morgen', 'Tomorrow')}: ${esc(tm.title)} · ${fT(tm.start)}</div>` : '')
      + (live.length ? `<button class="fhint" data-a="dayAll">${I('list')}<span>${L('Doppelt tippen für den ganzen Tag', 'Double-tap for the whole day')}</span></button>` : '') + `</div>`;
  }
  return { title: '', body: h, cls: 'fcp', app: 'focus ' + cc(color), bc: color, right: editBtn() };
}
// Restzeit als Uhr: 1:23:05 oder 42:10
function fmtLeft(ms){
  const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
// Jede Sekunde: Ring, Punkt und Countdown weiterdrehen (nur diese drei Werte, kein Neuaufbau)
let focusEnd = 0;
function focusTick(){
  const r = ui.tab === 'day' && !ui.dayAll ? $('.fring[data-e]', page) : null; if (!r) return;
  const s = +r.dataset.s, e = +r.dataset.e, now = Date.now(), fr = e > s ? clamp((now - s) / (e - s), 0, 1) : 1;
  const pg = $('.pg', r), hd = $('.fhd', r), cd = $('.fcd', r);
  if (pg) pg.style.strokeDashoffset = (RING_C * fr).toFixed(2);
  if (hd) hd.style.transform = `rotate(${((1 - fr) * 360).toFixed(2)}deg)`;
  if (cd) cd.textContent = fmtLeft(e - now);
  if (now >= e && focusEnd !== e){ focusEnd = e; setTimeout(() => safe('focusEnd', tick), 400); }   // Blocker vorbei: neu bestimmen
}
setInterval(() => { if (!document.hidden) focusTick(); }, 1000);
// Zwischen Vollbild und Tagesübersicht wechseln, mit weichem Übergang
function dayMode(all){
  ui.dayAll = all; scroller.scrollTop = 0; render(); onScroll();
  if (page.animate) try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) page.animate([{ opacity: .2, transform: `translate3d(0,${all ? 10 : -10}px,0)` }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1)' }); } catch (e) {}
}
A.dayAll = () => dayMode(true);
A.dayFocus = () => dayMode(false);
A.fAdd = el => todoPicker(el.dataset.d, el.dataset.o);
function dayAll(k, n, st){
  const list = occ(k), { cur, nxt, live } = st, f = cur || nxt;
  let h = `<h1 class="lt">${L('Heute', 'Today')}</h1><div class="lts">${fD(k, { wd: 'long', long: true })}</div>`;
  // Angehefteter Blocker: antippen öffnet wieder das Vollbild
  if (f){
    const s = tmin(f.start), e = tmin(f.end), pct = cur ? Math.round((n - s) / (e - s) * 100) : 0;
    h += `<button class="pin glass ${cc(f.color)}" data-a="dayFocus" aria-label="${L('Vollbild', 'Full screen')}">${tile(f)}<span class="cg"><span class="pk">${cur ? L('Jetzt', 'Now') : L('Als Nächstes', 'Up next')}</span><span class="ptt">${esc(f.title)}</span><span class="ps">${cur ? L(`noch ${fmtDur(e - n)} · bis ${fT(e)}`, `${fmtDur(e - n)} left · until ${fT(e)}`) : L(`um ${fT(s)} · in ${fmtDur(s - n)}`, `at ${fT(s)} · in ${fmtDur(s - n)}`)}</span></span>${I('expand', 'px')}${cur ? `<span class="pp"><i style="width:${pct}%"></i></span>` : ''}</button>`;
  } else if (live.length) h += `<button class="pin glass c-green" data-a="dayFocus">${`<span class="tile c-green">${I('check')}</span>`}<span class="cg"><span class="ptt">${L('Feierabend', 'All done')}</span><span class="ps">${L(`${live.length} Blocker geschafft`, `${live.length} blocks done`)}</span></span>${I('expand', 'px')}</button>`;
  h += `<div class="tl">`;
  if (!list.length) h += `<div class="empty"><b>${L('Heute ist frei', 'Today is free')}</b>${L('In deiner Master-Woche steht für heute nichts.', 'Nothing is planned for today in your master week.')}</div>`;
  let prevEnd = null, nowShown = !!cur;
  const gapS = `<div class="tlg" style="height:12px"><span></span><span class="dash"></span><span></span></div>`;
  const nowRow = () => `<div class="tlg nw" style="height:34px"><span class="tlt">${fT(n)}</span><span class="dot"></span><span class="gl">${L('Jetzt', 'Now')}${nxt ? ` · ${esc(nxt.title)} ${L('in', 'in')} ${fmtDur(tmin(nxt.start) - n)}` : ''}</span></div>`;
  list.forEach((o, i) => {
    const s = tmin(o.start), e = tmin(o.end);
    if (!o.skipped){
      if (!nowShown && n < s){ if (prevEnd !== null || i === 0) h += (prevEnd !== null ? gapS : '') + nowRow(); nowShown = true; prevEnd = Math.max(prevEnd ?? n, n); }
      if (prevEnd !== null){
        const gap = s - prevEnd;
        h += gap >= 15 ? `<div class="tlg" style="height:${Math.round(Math.min(64, Math.max(30, gap * .22)))}px"><span></span><span class="dash"></span><span class="gl">${L(`${fmtDur(gap)} frei`, `${fmtDur(gap)} free`)}</span></div>` : gapS;
      }
      prevEnd = Math.max(prevEnd ?? 0, e);
    } else if (prevEnd !== null) h += gapS;
    h += tlRow(o, n);
  });
  if (!nowShown && live.length) h += gapS + nowRow();
  h += `</div>`;
  const loose = D.todos.filter(x => !atOcc(x)).length;
  if (loose) h += `<button class="hint" data-a="goTodos"><span class="tile gray">${I('list')}</span><span class="cg">${L(loose === 1 ? '1 To-Do wartet noch auf einen Blocker.' : `${loose} To-Dos warten noch auf einen Blocker.`, loose === 1 ? '1 to-do is waiting for a block.' : `${loose} to-dos are waiting for a block.`)}</span>${CHEV}</button>`;
  return { title: L('Heute', 'Today'), body: h, right: editBtn() };
}
function tlRow(o, n){
  const s = tmin(o.start), e = tmin(o.end), dur = e - s;
  const now = !o.skipped && s <= n && n < e, past = !o.skipped && e <= n;
  const hgt = Math.round(Math.min(170, Math.max(52, 30 + dur * .42)));
  const items = o.skipped ? [] : todoItems(o), max = 4;
  const tds = items.slice(0, max).map(it => `<button class="${it.done ? 'dn' : ''}" data-a="tlTodo" data-k="${it.kind}" data-d="${o.date}" data-o="${esc(o.id)}" data-id="${esc(it.id)}"><span class="bx">${I('check')}</span>${prioMark(it.prio)}<span>${esc(it.title)}</span>${it.kind === 'r' ? I('repeat', 'rp') : ''}</button>`).join('')
    + (items.length > max ? `<em>${L(`+ ${items.length - max} weitere`, `+ ${items.length - max} more`)}</em>` : '');
  const tag = o.skipped ? L('Fällt heute aus', 'Skipped today') : o.extra ? L('Nur heute', 'Today only') : o.edited ? L('Heute geändert', 'Changed today') : '';
  return `<div class="tlr ${cc(o.color)}${now ? ' now' : ''}${past ? ' past' : ''}${o.skipped ? ' skip' : ''}" data-a="openOcc" data-d="${o.date}" data-id="${esc(o.id)}" role="button">
    <div class="tlt">${fT(s)}</div>
    <div class="rail"><div class="cap" style="height:${hgt}px">${I(o.icon)}</div></div>
    <div class="tlb"><div class="tt">${esc(o.title)}</div><div class="ts">${fR(s, e)} · ${fmtDur(dur)}${now ? ` · ${L(`noch ${fmtDur(e - n)}`, `${fmtDur(e - n)} left`)}` : ''}</div>${tag ? `<span class="tag">${tag}</span>` : ''}${tds ? `<div class="tdl">${tds}</div>` : ''}</div>
  </div>`;
}
A.openOcc = el => openOcc(el.dataset.d, el.dataset.id);
// Abhaken: Wiederkehrende behalten ihren Haken für heute, einmalige sind danach weg (nur gezählt)
A.tlTodo = el => {
  if (el.dataset.busy) return;
  const k = el.dataset.d, oid = el.dataset.o, id = el.dataset.id;
  if (el.dataset.k === 'r'){ checkRt(k, oid, id, !rtDone(k, oid, id)); save(); refreshAll(); return; }
  el.dataset.busy = '1'; el.classList.add('dn', 'bye');
  setTimeout(() => doneTodo(id), 320);
};
// Einmaliges To-Do erledigen: löschen, zählen, mit „Rückgängig“
function doneTodo(id){
  const t = D.todos.find(x => x.id === id); if (!t){ refreshAll(); return; }
  withUndo(L(`Erledigt: ${q(t.title)}`, `Done: ${q(t.title)}`), () => { if (!finishTodo(id)) return false; });
}
A.startSetup = () => { ui.sub = ['master']; switchTab('set'); };
A.sample = () => loadSample();
A.editToday = () => { ui.week = wkStart(today()); edEnter(); if (ui.tab !== 'week') switchTab('week'); else render(); scrollWeekToNow(); };

/* ---------- Woche ---------- */
const PPM = 1, TOP = 12, MINH = 14, MINP = 5;
let WK = null;   // Geometrie der angezeigten Woche (für Gesten)
VIEWS.week = () => {
  const start = ui.week, t = today(), n = nowMin(), isCur = start === wkStart(t);
  // Ausgefallene, verschobene oder ersetzte Blocker bleiben in der Woche unsichtbar (keine gestrichelten Reste)
  const days = weekKeys(start), all = days.map(d => occ(d).filter(o => !o.skipped));
  // Sichtbarer Bereich: Tagesbeginn bis Tagesende aus den Einstellungen, erweitert um frühere oder spätere Blocker
  let minS = dayS(), maxE = dayE();
  for (const l of all) for (const o of l){ minS = Math.min(minS, tmin(o.start)); maxE = Math.max(maxE, tmin(o.end)); }
  const AS = !ED.on && ui.assign ? D.todos.find(x => x.id === ui.assign.id) : null;
  if (!AS && ui.assign && !ED.on) ui.assign = null;
  const H0 = clamp(Math.floor(minS / 60), 0, 23), H1 = clamp(Math.ceil(maxE / 60), H0 + 1, 24);
  const Y = m => TOP + (m - H0 * 60) * PPM;
  WK = { days, H0, H1, Y, start };
  const rw = use12() ? 46 : 34, any = all.some(l => l.length);
  let h = `<div class="wkh"><span class="r">${fD(days[0], { wd: false })} – ${fD(days[6], { wd: false, year: true })}</span><span class="bt">`;
  if (!isCur && !ED.on) h += `<button class="gpill sm glass" data-a="weekNow">${L('Diese Woche', 'This week')}</button>`;
  if (!ED.on && !AS && any) h += `<button class="gpill sm glass" data-a="edStart">${L('Bearbeiten', 'Edit')}</button>`;
  h += `</span></div>`;
  if (ED.on) h += `<div class="edhint">${I('move')}<span>${L('Blocker antippen und ziehen, die anderen weichen aus. Kurz über einem Blocker halten, um ihn dort hineinzulegen. Die Griffe ändern die Dauer, die Nachbarn rücken mit. Gedrückt halten zeigt mehr. Gilt nur für diese Woche.', 'Tap a block and drag it, the others make room. Hold it over a block for a moment to drop it inside. The handles change the length, the neighbours move along. Press and hold for more. Applies to this week only.')}</span></div>`;
  h += `<div class="wk${ED.on ? ' editing' : ''}" style="--rw:${rw}px"${ED.on ? '' : ' data-swipe="wk"'}><div class="wk-h"><span></span>`;
  days.forEach(d => { h += `<button class="hd${d === t ? ' today' : ''}" data-a="dayMenu" data-d="${d}">${WD_S()[wdOf(d) - 1]}<b>${pd(d).getDate()}</b>${dayAdjusted(d) ? '<span class="dt"></span>' : ''}</button>`; });
  h += `</div><div class="wk-b" style="height:${Y(H1 * 60) + TOP}px"><div class="wk-t">`;
  for (let hr = H0; hr <= H1; hr++) h += `<span style="top:${Y(hr * 60)}px">${fH(hr)}</span>`;
  h += `</div>`;
  for (let hr = H0; hr <= H1; hr++) h += `<div class="wk-l" style="top:${Y(hr * 60)}px"></div>`;
  days.forEach((d, i) => {
    h += `<div class="wk-c${d === t ? ' today' : ''}" data-d="${d}"${ED.on ? ' data-a="edBg"' : ''}>`;
    let maxEnd = -1;
    all[i].forEach((o, j) => {
      const s = Math.max(tmin(o.start), H0 * 60), e = tmin(o.end);
      const hh = Math.max((e - s) * PPM, MINH) - 2;
      const ovl = s < maxEnd;
      maxEnd = Math.max(maxEnd, e);
      const sel = ED.on && ED.sel && ED.sel.k === d && ED.sel.id === o.id;
      const cut = sel && ED.cut && ED.cut.k === d && ED.cut.id === o.id;
      const sz = hh < 15 ? ' short xxs' : hh < 22 ? ' short xs' : hh < 34 ? ' short' : '';
      // Weißer Punkt: Der Blocker hat zugewiesene To-Dos. Abgehakte lassen ihn nicht verblassen.
      const cur = AS && AS.at && AS.at.date === d && AS.at.slot === o.id;
      h += `<div class="blk ${cc(o.color)}${sz}${ovl ? ' ovl' : ''}${todosAt(d, o.id).length ? ' td' : ''}${sel || cur ? ' sel' : ''}" data-d="${d}" data-id="${esc(o.id)}" data-a="${ED.on ? 'edTap' : AS ? 'asPick' : 'openOcc'}" role="button" aria-label="${esc(o.title)}, ${fR(o.start, o.end)}" style="top:${Y(s)}px;height:${hh}px;z-index:${j + 1}">${I(o.icon)}`
        + (sel && !cut ? `<span class="hdl top" data-e="top"></span><span class="hdl bot" data-e="bot"></span><button class="edel" data-a="edDel" data-d="${d}" data-id="${esc(o.id)}" aria-label="${L('Löschen', 'Delete')}">${I('minus')}</button>` : '')
        + (cut ? `<span class="cutl" style="top:${(ED.cut.at - s) * PPM}px"><span class="sc">${I('cutO')}</span><span class="tbub glass" style="left:50%;top:0">${fT(ED.cut.at)}</span></span>` : '')
        + `</div>`;
    });
    if (ED.on && ED.dup && ED.dup.k === d){
      const o = findOcc(d, ED.dup.id);
      if (o){ const s = tmin(o.start), e = tmin(o.end); h += `<div class="ghost pend ${cc(o.color)}" style="left:2px;right:2px;top:${Y(s) + 6}px;height:${Math.max((e - s) * PPM, MINH) - 2}px">${I(o.icon)}</div>`; }
    }
    if (d === t && n >= H0 * 60 && n <= H1 * 60) h += `<div class="nowl" style="top:${Y(n) - 1}px"></div>`;
    h += `</div>`;
  });
  h += `</div></div>`;
  if (!any) h += `<div class="empty">${L('In dieser Woche ist nichts geplant.', 'Nothing is planned this week.')}</div>`;
  else if (AS) h += `<div class="gf">${L('Wische oder nutze die Pfeile oben, um in eine andere Woche zu wechseln.', 'Swipe or use the arrows to switch to another week.')}</div>`;
  else if (!ED.on) h += `<div class="gf">${L('Tippe auf einen Block für Details. Halte ihn gedrückt, um die Woche zu bearbeiten. Ein weißer Punkt heißt, der Blocker hat To-Dos.', 'Tap a block for details. Press and hold to edit the week. A white dot means the block has to-dos.')}</div>`;
  const kwN = kw(addD(start, D.set.ws === 7 ? 1 : 0));
  let bar = '';
  if (ED.on && ED.cut) bar = `<div class="edbar glass"><span class="tx">${L('Ziehe die Linie dorthin, wo geteilt wird.', 'Drag the line to where the block is split.')}</span><button data-a="edCutX">${L('Abbrechen', 'Cancel')}</button><button class="b" data-a="edCutGo">${L('Teilen', 'Split')}</button></div>`;
  else if (AS) bar = `<div class="edbar glass asb"><span class="tx">${L(`Tippe auf einen Blocker für ${q(AS.title)}`, `Tap a block for ${q(AS.title)}`)}</span><button data-a="asCancel">${L('Abbrechen', 'Cancel')}</button></div>`;
  else if (ED.on && ED.dup) bar = `<div class="edbar glass"><span class="tx">${L('Ziehe die Kopie an den gewünschten Tag und die gewünschte Zeit.', 'Drag the copy to the day and time you want.')}</span><button data-a="edDupX">${L('Abbrechen', 'Cancel')}</button></div>`;
  if (ED.on) return { title: L('Bearbeiten', 'Edit'), navAlways: true, cls: 'wkp', body: h, bar,
    left: `<div class="gseg glass"><button data-a="edUndo" aria-label="${L('Rückgängig', 'Undo')}"${HIST.past.length ? '' : ' disabled'}>${I('undo')}</button><button data-a="edRedo" aria-label="${L('Wiederholen', 'Redo')}"${HIST.next.length ? '' : ' disabled'}>${I('redo')}</button></div>`,
    right: `<button class="gbtn glass" data-a="edAdd" aria-label="${L('Blocker hinzufügen', 'Add block')}">${I('plus')}</button><button class="gbtn glass tint" data-a="edDone" aria-label="${L('Fertig', 'Done')}">${I('check')}</button>` };
  return { title: LANG === 'en' ? `Week ${kwN}` : `KW ${kwN}`, navAlways: true, cls: 'wkp' + (AS ? ' asg' : ''), body: h, bar,
    left: `<button class="gbtn glass" data-a="weekPrev" aria-label="${L('Vorherige Woche', 'Previous week')}">${I('chevL')}</button>`,
    right: `<button class="gbtn glass" data-a="weekNext" aria-label="${L('Nächste Woche', 'Next week')}">${I('chevR')}</button>` };
};
function scrollWeekToNow(){
  if (!WK) return;
  const isCur = WK.start === wkStart(today());
  let minS = 24 * 60;
  for (const d of WK.days) for (const o of occ(d)) if (!o.skipped) minS = Math.min(minS, tmin(o.start));
  if (minS === 24 * 60) minS = WK.H0 * 60;
  const target = isCur ? Math.max(nowMin() - 120, WK.H0 * 60) : Math.max(minS - 30, WK.H0 * 60);
  scroller.scrollTop = Math.max(0, (target - WK.H0 * 60) * PPM);
  onScroll();
}
A.weekPrev = () => weekGo(-1);
A.weekNext = () => weekGo(1);
A.weekNow = () => { const to = wkStart(today()); if (to === ui.week) return; weekGo(to < ui.week ? -1 : 1, to, scrollWeekToNow); };
A.dayMenu = el => {
  const k = el.dataset.d, items = [{ label: L('Blocker nur an diesem Tag', 'Block on this day only'), fn: () => slotEditor({ mode: 'newWeek', day: k }) }];
  if (dayAdjusted(k)) items.push({ label: L('Tag auf Master-Woche zurücksetzen', 'Reset day to master week'), danger: true, fn: () => withUndo(L('Tag zurückgesetzt', 'Day reset'), () => resetDayData(k)) });
  menu(fD(k, { wd: 'long', long: true }), items);
};

/* ---------- Einstellungen ---------- */
const SUB = {};
VIEWS.set = () => { const p = ui.sub[ui.sub.length - 1]; return p && SUB[p] ? SUB[p]() : setRoot(); };
const srow = (o) => `<button class="cell tap" data-a="${o.a}"${o.p ? ` data-p="${o.p}"` : ''}${o.o ? ` data-o="${o.o}"` : ''}><span class="tile ${o.tile}">${I(o.icon)}</span><span class="cg">${o.label}</span>${o.value != null && o.value !== '' ? `<span class="cv">${esc(o.value)}</span>` : ''}${o.chev === false ? '' : CHEV}</button>`;
const OPTS = {
  lang: () => ({ cur: D.set.lang, items: [['auto', L(`Automatisch (${sysLang() === 'de' ? 'Deutsch' : 'English'})`, `Automatic (${sysLang() === 'de' ? 'Deutsch' : 'English'})`)], ['de', 'Deutsch'], ['en', 'English']], set: v => { D.set.lang = v; applyLang(); } }),
  clock: () => ({ cur: D.set.clock, items: [['auto', L(`Automatisch (${use12Auto() ? '12' : '24'} Std.)`, `Automatic (${use12Auto() ? '12' : '24'}-hour)`)], ['24', L('24 Stunden', '24-hour')], ['12', L('12 Stunden (AM/PM)', '12-hour (AM/PM)')]], set: v => { D.set.clock = v; } }),
  ws: () => ({ cur: D.set.ws, items: [[1, L('Montag', 'Monday')], [7, L('Sonntag', 'Sunday')]], set: v => { D.set.ws = v; ui.week = wkStart(today()); } }),
  snap: () => ({ cur: D.set.snap, items: SNAPS.map(m => [m, LANG === 'en' ? `${m} min` : `${m} Min.`]), set: v => { D.set.snap = v; } }),
  dayS: () => ({ cur: D.set.dayS, items: DAY_S.map(h => [h, fT(h * 60)]), set: v => { D.set.dayS = v; } }),
  dayE: () => ({ cur: D.set.dayE, items: DAY_E.map(h => [h, h === 24 ? L('Mitternacht', 'Midnight') : fT(h * 60)]), set: v => { D.set.dayE = v; } }),
  dur: () => ({ cur: D.set.dur, items: DURS.map(m => [m, fmtDur(m)]), set: v => { D.set.dur = v; } }),
  lead: () => ({ cur: D.set.push.lead, items: LEADS.map(m => [m, m ? L(`${m} Min. vorher`, `${m} min before`) : L('Zum Beginn', 'At start')]), set: v => { D.set.push.lead = v; } })
};
const use12Auto = () => LANG === 'en' ? SYS12 : false;
const optLabel = k => { const o = OPTS[k](), it = o.items.find(x => x[0] === o.cur); return it ? it[1].replace(/ \(.*\)$/, '') : ''; };
A.opt = el => {
  const o = OPTS[el.dataset.o]();
  popMenu({ anchor: el.querySelector('.cv') || el, items: o.items.map(([v, label]) => ({ label, check: v === o.cur, fn: () => { o.set(v); save(); render(); } })) });
};
function setRoot(){
  const s = D.set, t = today();
  const adj = Object.keys(D.ov).filter(k => k >= t && dayAdjusted(k)).length;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  let h = `<h1 class="lt">${L('Einstellungen', 'Settings')}</h1>`;
  h += expBanner();
  h += `<button class="prof glass" data-a="go" data-p="about" style="width:100%;text-align:left"><img src="apple-touch-icon.png" alt=""><div style="flex:1;min-width:0"><div class="pn">${APP}</div><div class="ps">${L('Version', 'Version')} ${APP_VERSION} · ${L('Alles bleibt auf diesem Gerät, ohne Konto und ohne KI.', 'Everything stays on this device. No account, no AI.')}</div></div>${CHEV}</button>`;
  h += `<div class="gh">${L('Planung', 'Planning')}</div><div class="grp">${srow({ a: 'go', p: 'master', tile: 'indigo', icon: 'calendar', label: L('Master-Woche', 'Master week'), value: L(`${D.slots.length} Blocker`, `${D.slots.length} blocks`) })}${srow({ a: 'go', p: 'away', tile: 'orange', icon: 'away', label: L('Ferien & Abweichungen', 'Holidays & changes'), value: adj ? (LANG === 'en' ? `${adj} days` : `${adj} Tage`) : '' })}</div>`;
  h += `<div class="gh">${L('Darstellung', 'Appearance')}</div><div class="grp"><div class="appear">
      <button data-a="theme" data-v="light"><span class="ph l"><i class="a"></i><i></i><i class="b"></i><i></i><i class="c"></i></span>${L('Hell', 'Light')}<span class="rad${!dark ? ' on' : ''}">${I('check')}</span></button>
      <button data-a="theme" data-v="dark"><span class="ph d"><i class="a"></i><i></i><i class="b"></i><i></i><i class="c"></i></span>${L('Dunkel', 'Dark')}<span class="rad${dark ? ' on' : ''}">${I('check')}</span></button></div>
    <div class="cell"><span class="cg">${L('Automatisch', 'Automatic')}<span class="cs">${L('Folgt der Einstellung deines iPhones', 'Follows your iPhone setting')}</span></span><button class="sw${s.theme === 'auto' ? ' on' : ''}" data-a="themeAuto" role="switch" aria-checked="${s.theme === 'auto'}" aria-label="${L('Automatisch', 'Automatic')}"></button></div>
    ${srow({ a: 'opt', o: 'lang', tile: 'gray', icon: 'lang', label: L('Sprache', 'Language'), value: optLabel('lang') })}</div>`;
  h += `<div class="gh">${L('Zeit', 'Time')}</div><div class="grp">${srow({ a: 'opt', o: 'clock', tile: 'blue', icon: 'clockO', label: L('Uhrzeit-Format', 'Time format'), value: optLabel('clock') })}${srow({ a: 'opt', o: 'ws', tile: 'red', icon: 'wstart', label: L('Woche beginnt am', 'Week starts on'), value: optLabel('ws') })}${srow({ a: 'opt', o: 'dayS', tile: 'yellow', icon: 'sunny', label: L('Tag beginnt um', 'Day starts at'), value: optLabel('dayS') })}${srow({ a: 'opt', o: 'dayE', tile: 'indigo', icon: 'moon', label: L('Tag endet um', 'Day ends at'), value: optLabel('dayE') })}${srow({ a: 'opt', o: 'snap', tile: 'teal', icon: 'grid', label: L('Raster beim Ziehen', 'Snap when dragging'), value: optLabel('snap') })}${srow({ a: 'opt', o: 'dur', tile: 'purple', icon: 'dur', label: L('Dauer neuer Blocker', 'New block length'), value: optLabel('dur') })}</div>`;
  h += `<div class="gh">${L('Erinnerungen', 'Reminders')}</div><div class="grp">${srow({ a: 'go', p: 'push', tile: 'red', icon: 'bell', label: L('Mitteilungen', 'Notifications'), value: s.push.on || (NATIVE && s.push.exp) ? L('An', 'On') : L('Aus', 'Off') })}</div>`;
  h += `<div class="gh">${L('Daten', 'Data')}</div><div class="grp">
    ${srow({ a: 'export', tile: 'blue', icon: 'up', label: L('Backup sichern', 'Save backup'), chev: false })}
    ${srow({ a: 'import', tile: 'green', icon: 'dl', label: L('Backup laden', 'Load backup'), chev: false })}
    ${NATIVE ? srow({ a: 'openBackups', tile: 'teal', icon: 'time', label: L('Tägliche Sicherungen', 'Daily backups'), value: L('Dateien', 'Files') }) : ''}
    ${D.slots.length ? '' : srow({ a: 'sample', tile: 'gray', icon: 'sample', label: L('Beispielwoche laden', 'Load sample week'), chev: false })}
    <button class="cell tap red" data-a="wipe"><span class="tile red">${I('trash')}</span><span class="cg">${L('Alle Daten löschen', 'Delete all data')}</span></button></div>`;
  h += `<div class="gh">${L('Hilfe', 'Help')}</div><div class="grp">${srow({ a: 'tut', tile: 'blue', icon: 'help', label: L('Einführung ansehen', 'Show introduction'), chev: false })}${srow({ a: 'go', p: 'about', tile: 'gray', icon: 'about', label: L(`Über ${APP}`, `About ${APP}`) })}</div>`;
  h += `<div class="gf">${NATIVE
    ? L('Schedule legt jeden Tag selbst eine Sicherung ab: Dateien-App › Auf meinem iPhone › Schedule › Sicherungen. Sie verschwindet, wenn du die App löschst. Sichere deshalb ab und zu ein Backup in iCloud Drive.', 'Schedule saves a backup by itself every day: Files app › On My iPhone › Schedule › Sicherungen. It is removed when you delete the app. So save a backup to iCloud Drive every now and then.')
    : L('Sichere ab und zu ein Backup, zum Beispiel in der Dateien-App.', 'Save a backup every now and then, for example in the Files app.')}</div>`;
  return { title: L('Einstellungen', 'Settings'), body: h };
}
function expBanner(){
  const e = expAt(); if (!e) return '';
  const left = e - Date.now(); if (left > 2 * 864e5) return '';
  return `<div class="banner glass">${I('hourglass')}<span class="bg">${left > 0 ? L(`Die App läuft am ${expWhen()} ab. Erneuere sie vorher am Computer, deine Daten bleiben erhalten.`, `The app expires on ${expWhen()}. Renew it on your computer before then, your data stays.`) : L('Die App ist abgelaufen. Erneuere sie am Computer.', 'The app has expired. Renew it on your computer.')}</span></div>`;
}
A.theme = el => { D.set.theme = el.dataset.v; save(); applyTheme(); render(); };
A.themeAuto = () => { D.set.theme = D.set.theme === 'auto' ? document.documentElement.getAttribute('data-theme') : 'auto'; save(); applyTheme(); render(); };
A.tut = () => tutorial();

SUB.master = () => {
  const order = wdOrder(), list = D.slots.slice().sort((a, b) => tmin(a.start) - tmin(b.start) || a.title.localeCompare(b.title, LANG));
  let minS = dayS(), maxE = dayE();
  for (const s of D.slots){ minS = Math.min(minS, tmin(s.start)); maxE = Math.max(maxE, tmin(s.end)); }
  const H0 = Math.floor(minS / 60) * 60, H1 = Math.ceil(maxE / 60) * 60, span = H1 - H0, twd = wdOf(today());
  let h = `<div class="lts" style="margin-top:2px">${L('Deine ideale Woche. Sie gilt automatisch jede Woche. Einzelne Tage passt du in der Wochenansicht an.', 'Your ideal week. It repeats every week automatically. You adjust single days in the week view.')}</div>`;
  h += `<div class="mweek glass"><div class="mh">${order.map(d => `<span class="${d === twd ? 'td' : ''}">${WD_S()[d - 1]}</span>`).join('')}</div><div class="mb">${order.map(d => `<div class="mc">${list.filter(s => s.days.includes(d)).map(s => `<span class="mk ${cc(s.color)}" data-a="editTpl" data-id="${esc(s.id)}" style="top:${(tmin(s.start) - H0) / span * 100}%;height:${(tmin(s.end) - tmin(s.start)) / span * 100}%"></span>`).join('')}</div>`).join('')}</div><div class="mf"><span>${fT(H0)}</span><span>${fT(Math.min(H1, DAY_END))}</span></div></div>`;
  h += `<div class="gh">${L('Blocker', 'Blocks')}</div><div class="grp">`;
  for (const s of list) h += `<button class="cell tap ${cc(s.color)}" data-a="editTpl" data-id="${esc(s.id)}">${tile(s)}<span class="cg"><span class="ct">${esc(s.title)}</span><span class="cs">${fR(s.start, s.end)} · ${daysLabel(s.days)}</span></span><span class="mdots">${order.map(d => `<i class="${s.days.includes(d) ? 'on' : ''}"></i>`).join('')}</span>${CHEV}</button>`;
  if (!list.length) h += `<div class="cell"><span class="cg muted">${L('Noch keine Blocker.', 'No blocks yet.')}</span></div>`;
  h += `<button class="cell tap tint" data-a="addTpl">${I('plus')}<span class="cg">${L('Neuer Blocker', 'New block')}</span></button></div>`;
  h += `<div class="gf">${L('Ein Blocker kann an mehreren Wochentagen gelten. Änderungen hier wirken auf jede Woche.', 'A block can repeat on several weekdays. Changes here apply to every week.')}</div>`;
  return { title: L('Master-Woche', 'Master week'), navAlways: true, body: h, left: backBtn(), right: `<button class="gbtn glass" data-a="addTpl" aria-label="${L('Neuer Blocker', 'New block')}">${I('plus')}</button>` };
};
A.editTpl = el => slotEditor({ mode: 'tpl', slotId: el.dataset.id });
A.addTpl = () => slotEditor({ mode: 'tpl' });

SUB.away = () => {
  const t = today(), dates = Object.keys(D.ov).filter(k => k >= t && dayAdjusted(k)).sort();
  let h = `<div class="grp" style="margin-top:6px"><button class="cell tap" data-a="rangeSkip"><span class="tile orange">${I('away')}</span><span class="cg"><span class="ct">${L('Ferien eintragen', 'Add holidays')}</span><span class="cs">${L('Blocker für einen Zeitraum ausfallen lassen', 'Skip blocks for a period')}</span></span>${CHEV}</button></div>`;
  h += `<div class="gh">${L('Kommende Abweichungen', 'Upcoming changes')}</div><div class="grp">`;
  for (const k of dates.slice(0, 60)){
    const l = occ(k), sk = l.filter(o => o.skipped), ex = l.filter(o => o.extra), ed = l.filter(o => o.edited), parts = [];
    if (sk.length) parts.push(sk.length === 1 ? L(`${sk[0].title} fällt aus`, `${sk[0].title} skipped`) : L(`${sk.length} fallen aus`, `${sk.length} skipped`));
    if (ex.length) parts.push(ex.length === 1 ? `+ ${ex[0].title}` : L(`+ ${ex.length} einmalig`, `+ ${ex.length} one-off`));
    if (ed.length) parts.push(L(`${ed.length} geändert`, `${ed.length} changed`));
    h += `<div class="cell"><span class="cg"><span class="ct">${rel(k)}</span><span class="cs">${esc(parts.join(' · '))}</span></span><button class="ib t" data-a="resetDate" data-d="${k}" aria-label="${L('Zurücksetzen', 'Reset')}">${I('undo')}</button></div>`;
  }
  if (dates.length > 60) h += `<div class="cell"><span class="cg muted">${L(`… und ${dates.length - 60} weitere Tage`, `… and ${dates.length - 60} more days`)}</span></div>`;
  if (!dates.length) h += `<div class="cell"><span class="cg muted">${L('Keine. Es gilt überall deine Master-Woche.', 'None. Your master week applies everywhere.')}</span></div>`;
  h += `</div>`;
  if (dates.length) h += `<div class="grp mt"><button class="cell tap tint" data-a="resetAll"><span class="cg">${L('Alles zurück zur Master-Woche', 'Reset everything to master week')}</span></button></div>`;
  h += `<div class="gf">${L('Mit ↺ setzt du einen Tag zurück. Einzelne Tage änderst du direkt in der Wochenansicht.', 'Use ↺ to reset a day. You change single days directly in the week view.')}</div>`;
  return { title: L('Ferien & Abweichungen', 'Holidays & changes'), navAlways: true, body: h, left: backBtn() };
};
A.rangeSkip = () => rangeSkipSheet();
A.resetDate = el => { const k = el.dataset.d; withUndo(L(`${fD(k)} zurückgesetzt`, `${fD(k)} reset`), () => resetDayData(k)); };
A.resetAll = () => withUndo(L('Alles wieder wie die Master-Woche', 'Everything back to master week'), () => { const t = today(); const ks = Object.keys(D.ov).filter(k => k >= t); if (!ks.length) return false; ks.forEach(resetDayData); });

// iPhone-App: Das iPhone erinnert selbst. Kein Server, keine Adresse, kein Abgleich.
function pushNative(){
  const p = D.set.push, st = pushStatus(), e = expAt(), any = p.on || (e && p.exp);
  let h = `<div class="stat glass"><div class="sr"><span class="tile lg red">${I('bell')}</span><div><div class="st">${L('Mitteilung, wenn ein Blocker beginnt', 'A notification when a block starts')}</div><div class="ss">${L('Dein iPhone erinnert dich selbst, ohne Server und ohne Internet. Nichts verlässt das Gerät.', 'Your iPhone reminds you by itself, with no server and no internet. Nothing leaves the device.')}</div></div></div></div>`;
  if (any && st.st === 'denied') h += `<div class="banner glass">${I('bell')}<span class="bg">${L('Mitteilungen sind in den iPhone-Einstellungen ausgeschaltet.', 'Notifications are turned off in the iPhone Settings.')}</span><button class="gpill sm glass" data-a="openSettings">${L('Öffnen', 'Open')}</button></div>`;
  h += `<div class="grp mt"><div class="cell"><span class="cg">${L('Wenn ein Blocker beginnt', 'When a block starts')}</span><button class="sw${p.on ? ' on' : ''}" data-a="pushToggle" role="switch" aria-checked="${!!p.on}" aria-label="${L('Wenn ein Blocker beginnt', 'When a block starts')}"></button></div>${srow({ a: 'opt', o: 'lead', tile: 'orange', icon: 'clockO', label: L('Erinnern', 'Remind me'), value: optLabel('lead') })}</div>`;
  if (e){
    h += `<div class="grp mt"><div class="cell"><span class="cg">${L('Bevor die App abläuft', 'Before the app expires')}<span class="cs w">${L(`Läuft ab am ${expWhen()}`, `Expires on ${expWhen()}`)}</span></span><button class="sw${p.exp ? ' on' : ''}" data-a="expToggle" role="switch" aria-checked="${!!p.exp}" aria-label="${L('Bevor die App abläuft', 'Before the app expires')}"></button></div></div>`;
    h += `<div class="gf">${L('Du bekommst zwei Tage, einen Tag und drei Stunden vorher eine Mitteilung. Dann erneuerst du die App am Computer.', 'You get a notification two days, one day and three hours before. Then you renew the app on your computer.')}</div>`;
  }
  if (any) h += `<div class="mt"><button class="abtn soft" data-a="pushTest">${I('send')}${L('Test-Mitteilung senden', 'Send test notification')}</button></div>`;
  const till = st.until ? rel(dkey(new Date(st.until))).replace(/\.$/, '') : '';
  if (any && st.st !== 'denied' && st.n && till) h += `<div class="gf">${L(st.n === 1 ? `1 Erinnerung ist geplant, für ${till}.` : `${st.n} Erinnerungen sind geplant, die letzte für ${till}.`, st.n === 1 ? `1 reminder is planned, for ${till}.` : `${st.n} reminders are planned, the last one for ${till}.`)}</div>`;
  h += `<div class="gf">${L('iOS merkt sich höchstens 64 Erinnerungen im Voraus. Schedule legt bei jedem Öffnen nach. Öffne die App deshalb mindestens einmal pro Woche.', 'iOS keeps at most 64 reminders in advance. Schedule tops them up every time you open it. So open the app at least once a week.')}</div>`;
  return { title: L('Mitteilungen', 'Notifications'), navAlways: true, body: h, left: backBtn() };
}
SUB.push = () => {
  if (NATIVE) return pushNative();
  const p = D.set.push, st = pushStatus(), ok = pushSupported(), inst = isStandalone();
  let h = `<div class="stat glass"><div class="sr"><span class="tile lg red">${I('bell')}</span><div><div class="st">${L('Mitteilung, wenn ein Blocker beginnt', 'A notification when a block starts')}</div><div class="ss">${L('Dein eigener kleiner Push-Server schickt das Signal. Er kennt nur Uhrzeiten, die Namen deiner Blocker bleiben auf dem Handy.', 'Your own small push server sends the signal. It only knows times, your block names stay on the phone.')}</div></div></div></div>`;
  if (!ok || !inst) h += `<div class="banner glass">${I('phone')}<span class="bg">${L('Mitteilungen gehen nur, wenn Schedule über den Home-Bildschirm geöffnet wird (Safari → Teilen → Zum Home-Bildschirm, ab iOS 16.4).', 'Notifications only work when Schedule is opened from the Home Screen (Safari → Share → Add to Home Screen, iOS 16.4 or later).')}</span></div>`;
  h += `<div class="gh">${L('Server', 'Server')}</div><div class="grp"><div class="cell"><span class="tile gray">${I('server')}</span><input class="fi" name="purl" id="purl" type="url" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="https://schedule-push.….workers.dev" value="${esc(p.url)}" data-enter="pushUrl"></div></div>`;
  h += `<div class="gf">${L('Die Adresse bekommst du beim Einrichten des Servers (siehe Anleitung in deinem Vault).', 'You get the address when you set up the server (see the guide in your vault).')}</div>`;
  h += `<div class="grp mt"><div class="cell"><span class="cg">${L('Mitteilungen', 'Notifications')}</span><button class="sw${p.on ? ' on' : ''}" data-a="pushToggle" role="switch" aria-checked="${!!p.on}" aria-label="${L('Mitteilungen', 'Notifications')}"></button></div>${srow({ a: 'opt', o: 'lead', tile: 'orange', icon: 'clockO', label: L('Erinnern', 'Remind me'), value: optLabel('lead') })}</div>`;
  if (p.on) h += `<div class="mt"><button class="abtn soft" data-a="pushTest">${I('send')}${L('Test-Mitteilung senden', 'Send test notification')}</button><button class="abtn soft" data-a="pushNow">${I('repeat')}${L('Jetzt abgleichen', 'Sync now')}</button></div>`;
  const info = st.err ? `<span style="color:var(--red)">${esc(st.err)}</span>` : st.last ? L(`Zuletzt abgeglichen: ${rel(dkey(new Date(st.last)))}, ${fT(new Date(st.last).getHours() * 60 + new Date(st.last).getMinutes())} · ${st.n || 0} Termine für die nächsten 4 Wochen geplant.`, `Last synced: ${rel(dkey(new Date(st.last)))}, ${fT(new Date(st.last).getHours() * 60 + new Date(st.last).getMinutes())} · ${st.n || 0} reminders planned for the next 4 weeks.`) : '';
  if (info) h += `<div class="gf">${info}</div>`;
  h += `<div class="gf">${L('Nach Änderungen gleicht Schedule die Zeiten von selbst ab, sobald die App offen ist. Öffne sie mindestens alle paar Wochen einmal.', 'After changes Schedule syncs the times by itself while the app is open. Open it at least every few weeks.')}</div>`;
  return { title: L('Mitteilungen', 'Notifications'), navAlways: true, body: h, left: backBtn() };
};
SUB.about = () => {
  let h = `<div style="text-align:center;margin-top:10px"><img src="apple-touch-icon.png" alt="" style="width:96px;height:96px;border-radius:22px;box-shadow:0 6px 18px rgba(0,0,0,.16)"><div style="font-size:26px;font-weight:800;margin-top:12px">${APP}</div><div class="muted" style="font-size:15px">${L('Version', 'Version')} ${APP_VERSION}</div></div>`;
  h += `<div class="grp mt"><div class="cell">${I('lock')}<span class="cg">${L('Deine Daten bleiben auf diesem Gerät. Kein Konto, keine KI, keine Werbung.', 'Your data stays on this device. No account, no AI, no ads.')}</span></div><div class="cell">${I('calendar')}<span class="cg">${L('Eine Master-Woche, Abweichungen nur für einzelne Tage.', 'One master week, changes for single days only.')}</span></div><div class="cell">${I('bell')}<span class="cg">${NATIVE ? L('Erinnerungen kommen direkt von deinem iPhone, ohne Server und ohne Internet.', 'Reminders come straight from your iPhone, with no server and no internet.') : L('Mitteilungen über deinen eigenen Push-Server, der nur Uhrzeiten kennt.', 'Notifications via your own push server, which only knows times.')}</span></div></div>`;
  if (NATIVE){
    const e = expAt();
    h += `<div class="gh">${L('iPhone-App', 'iPhone app')}</div><div class="grp"><div class="cell">${I('phone')}<span class="cg"><span class="ct">${L('Läuft ohne Internet', 'Works without internet')}</span><span class="cs w">${L('Alles steckt in der App auf diesem iPhone.', 'Everything is inside the app on this iPhone.')}${NINFO.build ? ` Build ${esc(NINFO.build)}.` : ''}</span></span></div>`
      + (e ? `<div class="cell">${I('hourglass')}<span class="cg"><span class="ct w">${L(`Gültig bis ${expWhen()}`, `Valid until ${expWhen()}`)}</span><span class="cs w">${L('Danach am Computer erneuern. Deine Daten bleiben erhalten.', 'Renew it on your computer afterwards. Your data stays.')}</span></span></div>` : '')
      + `${srow({ a: 'openBackups', tile: 'teal', icon: 'time', label: L('Tägliche Sicherungen', 'Daily backups'), value: L('Dateien', 'Files') })}</div>`;
  }
  h += `<div class="gf">${L('Symbole: Ionicons, © Ionic, MIT-Lizenz.', 'Icons: Ionicons, © Ionic, MIT license.')}</div>`;
  const log = errLog();
  if (log.length){
    const last = log[log.length - 1], d = new Date(last.t);
    h += `<div class="gh">${L('Fehlerprotokoll', 'Error log')}</div><div class="grp"><div class="cell"><span class="cg"><span class="ct">${L(`${log.length} Einträge`, `${log.length} entries`)}</span><span class="cs">${L('Zuletzt', 'Last')}: ${rel(dkey(d))}, ${fT(d.getHours() * 60 + d.getMinutes())} · ${esc(last.w)}: ${esc(last.m)}</span></span></div>${srow({ a: 'logCopy', tile: 'blue', icon: 'copy', label: L('Protokoll kopieren', 'Copy log'), chev: false })}${srow({ a: 'logClear', tile: 'gray', icon: 'trash', label: L('Protokoll leeren', 'Clear log'), chev: false })}</div>`;
    h += `<div class="gf">${L('Das Protokoll bleibt auf diesem Gerät. Zum Melden eines Fehlers kopieren und weitergeben.', 'The log stays on this device. Copy it to report a problem.')}</div>`;
  }
  return { title: L(`Über ${APP}`, `About ${APP}`), navAlways: true, body: h, left: backBtn() };
};
A.logCopy = async () => {
  const txt = `${APP} ${APP_VERSION} · ${navigator.userAgent}\n` + errLog().map(x => `${new Date(x.t).toISOString()} [${x.v}] ${x.w}: ${x.m} ${x.s}`).join('\n');
  if (NATIVE && post('copy', { text: txt })){ toast(L('Protokoll kopiert', 'Log copied')); return; }
  try { await navigator.clipboard.writeText(txt); toast(L('Protokoll kopiert', 'Log copied')); }
  catch (e) { toast(L('Kopieren ging nicht', 'Could not copy')); }
};
A.logClear = () => { try { localStorage.removeItem(LOGK); } catch (e) {} render(); toast(L('Protokoll geleert', 'Log cleared')); };
A.export = () => exportData();
A.import = () => { const f = $('#imp'); f.value = ''; f.click(); };
A.wipe = async () => {
  if (!await ask({ title: L('Alle Daten löschen?', 'Delete all data?'), msg: L('Master-Woche, Abweichungen und To-Dos werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.', 'Master week, changes and to-dos are deleted from this device. This cannot be undone.'), ok: L('Löschen', 'Delete'), danger: true })) return;
  const keep = D.set; replaceData(blank()); D.set = { ...keep, push: { ...keep.push } }; save(); refreshAll(); toast(L('Alle Daten gelöscht', 'All data deleted'));
};
