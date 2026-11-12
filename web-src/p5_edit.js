
/* ================= Bearbeiten-Modus der Woche ================= */
// Wie „Home-Bildschirm anpassen“: Blocker gedrückt halten, dann ziehen, an den Griffen kürzen/verlängern,
// duplizieren, aufteilen oder löschen. Alles gilt nur für die angezeigte Woche (Abweichungen pro Tag).
const LONG = 450, LONG_ED = 500, SLOP = 8;
let G = null;             // laufende Geste
let swallow = 0;          // den Klick, den eine beendete Geste noch auslöst, schlucken (bis zum nächsten Antippen)

function edEnter(k, id){
  if (!ED.on) histReset(JSON.stringify(D));   // neue Sitzung, neuer Verlauf
  ED.on = true; ED.sel = k && id ? { k, id } : null; ED.cut = ED.dup = null;
}
function edExit(r = true){
  if (!ED.on) return;
  ED.on = false; ED.sel = ED.cut = ED.dup = null; histReset(null);
  if (r && ui.tab === 'week') keepView(render);
}
function histReset(cur){ HIST.past = []; HIST.next = []; HIST.cur = cur; }
// Rückgängig und Wiederholen: springt im Verlauf der Sitzung einen Stand zurück oder vor
function histGo(back){
  const from = back ? HIST.past : HIST.next, to = back ? HIST.next : HIST.past;
  if (!ED.on || G || HIST.cur === null || !from.length) return;
  to.push(HIST.cur); HIST.cur = from.pop();
  HIST.mute = true;
  try { replaceData(migrate(JSON.parse(HIST.cur))); } finally { HIST.mute = false; }
  HIST.cur = JSON.stringify(D);   // so wie gespeichert, sonst zählt der nächste Speichervorgang als Änderung
  ED.cut = ED.dup = null;
  if (ED.sel && !findOcc(ED.sel.k, ED.sel.id)) ED.sel = null;
  keepView(refreshAll);
  toast(back ? L('Rückgängig gemacht', 'Undone') : L('Wiederhergestellt', 'Redone'));
}
A.edUndo = () => histGo(true);
A.edRedo = () => histGo(false);
A.edStart = () => { edEnter(); keepView(render); };
A.edDone = () => edExit();
A.edAdd = () => {
  const ks = WK ? WK.days : weekKeys(ui.week);
  const k = ED.sel && ks.includes(ED.sel.k) ? ED.sel.k : ks.includes(today()) ? today() : ks[0];
  slotEditor({ mode: 'newWeek', day: k, week: ks, onAdd: (k2, id) => { if (ED.on) ED.sel = { k: k2, id }; } });
};
A.edTap = el => {
  if (ED.cut || ED.dup) return;
  const k = el.dataset.d, id = el.dataset.id;
  if (ED.sel && ED.sel.k === k && ED.sel.id === id) blockMenu(k, id);
  else { ED.sel = { k, id }; render(); }
};
A.edBg = () => { if (ED.cut || ED.dup || !ED.sel) return; ED.sel = null; render(); };
A.edDel = el => applyDelete(el.dataset.d, el.dataset.id);
A.edCutGo = () => applyCut();
A.edCutX = () => { ED.cut = null; render(); };
A.edDupX = () => { ED.dup = null; render(); };

// Beim Neuzeichnen bleibt die Uhrzeit unter der Kopfzeile an derselben Stelle (der Zeitraum kann sich ändern)
function keepView(fn){
  const wb = ui.tab === 'week' && WK && $('.wk-b', page), hd = wb && $('.wk-h', page);
  if (!wb || !hd){ fn(); return; }
  const ref = hd.getBoundingClientRect().bottom, m = WK.H0 * 60 + (ref - wb.getBoundingClientRect().top - TOP) / PPM;
  fn();
  const wb2 = ui.tab === 'week' && WK && $('.wk-b', page), hd2 = wb2 && $('.wk-h', page);
  if (!wb2 || !hd2) return;
  scroller.scrollTop += wb2.getBoundingClientRect().top + TOP + (m - WK.H0 * 60) * PPM - hd2.getBoundingClientRect().bottom;
  onScroll();
}

/* ---------- Geometrie ---------- */
const blockEl = (k, id) => [...page.querySelectorAll('.blk')].find(b => b.dataset.d === k && b.dataset.id === id) || null;
const yToMin = y => WK.H0 * 60 + (y - $('.wk-b', page).getBoundingClientRect().top - TOP) / PPM;
const snapM = m => Math.round(m / D.set.snap) * D.set.snap;
const snapFrom = (base, m) => Math.abs(m - base) < D.set.snap / 2 ? base : snapM(m);   // kleine Bewegungen ändern nichts
function colAt(x){
  let best = null, bd = Infinity;
  for (const c of page.querySelectorAll('.wk-c')){ const r = c.getBoundingClientRect(), d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0; if (d < bd){ bd = d; best = c; } }
  return best;
}

/* ---------- Regeln für einen Tag ---------- */
// Bearbeitbare Termine eines Tages (ausgefallene bleiben außen vor).
// p = Aussehen für Kopien, src = Master-Blocker, rt = Kopien zeigen dessen wiederkehrende To-Dos
function dayList(k){
  const xs = D.ov[k] ? D.ov[k].x : [];
  return occ(k).filter(o => !o.skipped).map(o => ({
    id: o.id, s: tmin(o.start), e: tmin(o.end), extra: o.extra, src: o.extra ? o.src : o.id,
    rt: o.extra ? !!(xs.find(x => x.id === o.id) || {}).rt : true,
    p: { title: o.title, desc: o.desc || '', color: o.color, icon: o.icon }
  }));
}
// Bereich [s, e) beanspruchen: Überlappende werden gekürzt oder geteilt, ganz überdeckte gesammelt
function carve(list, s, e){
  const out = [], covered = [];
  for (const x of list){
    if (x.e <= s || x.s >= e){ out.push(x); continue; }
    const head = s - x.s >= MINP, tail = x.e - e >= MINP;
    if (head) out.push({ ...x, e: s });
    if (tail) out.push(head ? { ...x, id: uid(), s: e, add: true, rt: false } : { ...x, s: e });
    if (!head && !tail) covered.push(x);
  }
  return { out, covered };
}
// Ausweichen: Der bewegte Blocker liegt bei [s, e), die anderen rücken zur Seite und behalten ihre Dauer.
// Liegt die Mitte eines Blockers vor der Mitte des bewegten, weicht er nach oben aus, sonst nach unten.
// Lücken fangen das Schieben auf. Was sich vorher schon überlappte, darf das weiter.
function pushAside(list, s, e){
  const mid = (s + e) / 2, out = [], up = [], dn = [];
  for (const x of list.filter(y => (y.s + y.e) / 2 >= mid).sort((a, b) => a.s - b.s || a.e - b.e)){
    let ns = Math.max(x.s, e);
    for (const y of dn) if (y.o.e <= x.s) ns = Math.max(ns, y.n.e);   // was vorher davor lag, bleibt davor
    const n = ns === x.s ? x : { ...x, s: ns, e: x.e + ns - x.s };
    dn.push({ o: x, n }); out.push(n);
  }
  for (const x of list.filter(y => (y.s + y.e) / 2 < mid).sort((a, b) => b.e - a.e || b.s - a.s)){
    let ne = Math.min(x.e, s);
    for (const y of up) if (y.o.s >= x.e) ne = Math.min(ne, y.n.s);
    const n = ne === x.e ? x : { ...x, s: x.s - (x.e - ne), e: ne };
    up.push({ o: x, n }); out.push(n);
  }
  return { list: out, moved: out.filter(n => !list.includes(n)) };
}
// Löschen ohne Lücke: Was danach beginnt, rückt von unten nach oben auf
function closeGap(list, x){
  const others = list.filter(y => y.id !== x.id);
  const anchor = Math.max(x.s, ...others.filter(y => y.s < x.s && y.e > x.s).map(y => y.e));
  const rest = others.filter(y => y.s >= x.s), A = rest.length ? Math.max(0, Math.min(...rest.map(y => y.s)) - anchor) : 0;
  return { list: others.map(y => y.s >= x.s ? { ...y, s: y.s - A, e: y.e - A } : y), A };
}
// Grenzen eines Tages: Tagesbeginn und -ende aus den Einstellungen, erweitert um Blocker, die schon früher oder später liegen
function dayLim(list){
  return [Math.max(0, Math.min(dayS(), ...list.map(y => y.s))), Math.min(DAY_END, Math.max(dayE(), ...list.map(y => y.e)))];
}
// Dauer ändern ohne Lücke und ohne Überschreiben (x = alter Stand, ns/ne = neue Zeiten):
// Verlängern schiebt die anschließenden Blocker weiter, Lücken fangen das Schieben auf.
// Kürzen zieht die direkt anschließende Kette (Lücke höchstens MINP) um dieselbe Zeit nach.
function resizePlan(others, x, ns, ne){
  const map = new Map();
  const shiftChain = (list, gap, d, down) => {   // gap = Kante von x vorher, d = Verschiebung
    if (d > 0 === down){
      // Verlängern: kaskadierend schieben, wie beim Ausweichen
      const done = [], edge = down ? gap + d : gap + d;
      for (const y of list){
        let v = down ? Math.max(y.s, edge) : Math.min(y.e, edge);
        for (const p of done) if (down ? p.o.e <= y.s : p.o.s >= y.e) v = down ? Math.max(v, p.n.e) : Math.min(v, p.n.s);
        const n = down ? (v === y.s ? y : { ...y, s: v, e: y.e + v - y.s }) : (v === y.e ? y : { ...y, s: y.s - (y.e - v), e: v });
        done.push({ o: y, n }); if (n !== y) map.set(y.id, n);
      }
    } else {
      // Kürzen: nur die anliegende Kette rückt nach
      let cur = gap;
      for (const y of list){
        if (down ? y.s - cur > MINP : cur - y.e > MINP) break;
        cur = down ? Math.max(cur, y.e) : Math.min(cur, y.s);
        map.set(y.id, { ...y, s: y.s + d, e: y.e + d });
      }
    }
  };
  if (ne !== x.e) shiftChain(others.filter(y => y.s >= x.e).sort((a, b) => a.s - b.s || a.e - b.e), x.e, ne - x.e, true);
  if (ns !== x.s) shiftChain(others.filter(y => y.e <= x.s).sort((a, b) => b.e - a.e || b.s - a.s), x.s, ns - x.s, false);
  return others.map(y => map.get(y.id) || y);
}
const outside = (list, lim) => list.some(y => y.s < lim[0] || y.e > lim[1]);
// Alles muss in den Tag passen; was nicht mehr hineinpasst, fällt aus
function fitDay(list, lim = [0, DAY_END]){
  const keep = [], lost = [];
  for (const x of list){ const s = Math.max(lim[0], x.s), e = Math.min(lim[1], x.e); if (e - s >= MINP) keep.push(s === x.s && e === x.e ? x : { ...x, s, e }); else lost.push(x); }
  return { keep, lost };
}

/* ---------- Änderungen übernehmen (nur für diesen Tag) ---------- */
function dropOcc(k, b){
  if (b.extra){
    const o = D.ov[k]; if (o) o.x = o.x.filter(s => s.id !== b.id);
    unassign(t => t.at.date === k && t.at.slot === b.id);
    if (D.chk[k]){ delete D.chk[k][b.id]; if (!Object.keys(D.chk[k]).length) delete D.chk[k]; }
    if (D.rto[k]){ delete D.rto[k][b.id]; if (!Object.keys(D.rto[k]).length) delete D.rto[k]; }
  } else { const r = ensureOs(k, b.id); r.skip = 1; delete r.e; }
}
function setOccTime(k, b, s, e){
  if (b.extra){ const x = D.ov[k] && D.ov[k].x.find(y => y.id === b.id); if (x){ x.start = fmtT(s); x.end = fmtT(e); } return; }
  const m = slotById(b.id); if (!m) return;
  const r = ensureOs(k, b.id), ed = { ...(r.e || {}), start: fmtT(s), end: fmtT(e) };
  if (ed.start === m.start) delete ed.start;
  if (ed.end === m.end) delete ed.end;
  if (Object.keys(ed).length) r.e = ed; else delete r.e;
}
// Neuer Termin an einem Tag. Fiel derselbe Master-Blocker an diesem Tag aus, wird er einfach wieder eingeplant.
function placeNew(k, x){
  const m = x.src ? slotById(x.src) : null, p = x.p;
  if (m && x.rt && m.days.includes(wdOf(k))){
    const r = D.ov[k] && D.ov[k].s[m.id];
    if (r && r.skip){
      delete r.skip;
      const v = { ...p, start: fmtT(x.s), end: fmtT(x.e) }, ed = {};
      for (const f of FIELDS) if (!same(v[f] ?? '', m[f] ?? '')) ed[f] = v[f];
      if (Object.keys(ed).length) r.e = ed; else delete r.e;
      return m.id;
    }
  }
  const id = uid();
  ensureOv(k).x.push({ id, title: p.title, desc: m && p.desc === m.desc ? '' : p.desc, start: fmtT(x.s), end: fmtT(x.e), color: p.color, icon: p.icon,
    ...(x.src ? { src: x.src } : {}), ...(x.src && x.rt ? { rt: true } : {}) });
  return id;
}
// To-Dos und Haken wandern mit, wenn ein Termin an einen anderen Tag zieht
function moveLinks(k1, id1, k2, id2){
  for (const t of D.todos) if (t.at && t.at.date === k1 && t.at.slot === id1) t.at = { date: k2, slot: id2 };
  const ro = D.rto[k1] && D.rto[k1][id1];
  if (ro){ delete D.rto[k1][id1]; if (!Object.keys(D.rto[k1]).length) delete D.rto[k1]; const d = D.rto[k2] || (D.rto[k2] = {}); d[id2] = { ...(d[id2] || {}), ...ro }; }
  const c = D.chk[k1] && D.chk[k1][id1]; if (!c) return;
  delete D.chk[k1][id1]; if (!Object.keys(D.chk[k1]).length) delete D.chk[k1];
  const d = D.chk[k2] || (D.chk[k2] = {}); d[id2] = { ...(d[id2] || {}), ...c };
}
// Neue Tagesliste übernehmen: Fehlende fallen aus, geänderte Zeiten werden Abweichungen, neue werden Einzeltermine
function commitDay(k, plan, lim){
  const before = new Map(dayList(k).map(x => [x.id, x]));
  const { keep, lost } = fitDay(plan, lim), ids = {};
  const stay = new Set(keep.filter(x => !x.add).map(x => x.id));
  for (const [id, b] of before) if (!stay.has(id)) dropOcc(k, b);
  for (const x of keep){
    if (x.add){ ids[x.id] = placeNew(k, x); continue; }
    const b = before.get(x.id); if (!b) continue;
    if (b.s !== x.s || b.e !== x.e) setOccTime(k, b, x.s, x.e);
    ids[x.id] = x.id;
  }
  cleanOv(k); OCC.delete(k);
  return { ids, lost };
}

/* ---------- Aktionen ---------- */
// Verschieben (auch an einen anderen Tag) oder Kopie ablegen. Die anderen Blocker am Ziel weichen aus.
// into = Blocker, in den der bewegte hineingelegt wird (lange darüber gehalten): Der wird dort geteilt.
async function placeMove(k1, id, k2, s2, copy, into){
  const l1 = dayList(k1), x = l1.find(y => y.id === id);
  if (!x){ keepView(render); return; }
  const e2 = s2 + (x.e - x.s), sameDay = k1 === k2;
  const others = (sameDay ? l1 : dayList(k2)).filter(y => copy || y.id !== id);
  const tg = into ? others.find(y => y.id === into) : null;
  let plan, extra = '', lim;
  if (tg){
    const c = carve(others, s2, e2); plan = c.out;
    extra = c.covered.some(y => y.id === tg.id) ? L(`, ersetzt ${q(tg.p.title)}`, `, replaces ${q(tg.p.title)}`) : L(`, in ${q(tg.p.title)}`, `, inside ${q(tg.p.title)}`);
  } else {
    lim = dayLim([...others, { s: s2, e: e2 }]);
    const p = pushAside(others, s2, e2), lost = p.list.filter(y => y.s < lim[0] || y.e > lim[1]);
    if (lost.length){
      const one = lost.length === 1, names = lost.map(y => q(y.p.title)).join(', ');
      const ok = await choose({
        title: one ? L(`${names} passt nicht mehr ganz in den Tag`, `${names} no longer fits into the day`) : L(`${lost.length} Blocker passen nicht mehr ganz in den Tag`, `${lost.length} blocks no longer fit into the day`),
        msg: L(`Beim Ausweichen rutscht ${one ? 'er' : 'sie'} über den Tag hinaus. Was nicht mehr hineinpasst, wird abgeschnitten, ein ganz verdrängter Blocker fällt an diesem Tag aus.`, `Making room pushes ${one ? 'it' : 'them'} past the day. Whatever no longer fits is cut off, a block pushed out completely is skipped on this day.`),
        vertical: true,
        buttons: [{ label: L('Trotzdem verschieben', 'Move anyway'), v: 1, cls: 'dl' }, { label: L('Abbrechen', 'Cancel'), v: null }]
      });
      if (!ok){ keepView(render); return; }
    }
    plan = p.list;
    const n = p.moved.length - fitDay(p.moved, lim).lost.length;
    if (n) extra = n === 1 ? L(', 1 Blocker weicht aus', ', 1 block made room') : L(`, ${n} Blocker weichen aus`, `, ${n} blocks made room`);
  }
  const t = x.p.title, isNew = copy || !sameDay, nx = { ...x, id: isNew ? uid() : x.id, s: s2, e: e2, add: isNew };
  const msg = (copy ? L(`${q(t)} dupliziert: ${fD(k2)}, ${fR(s2, e2)}`, `${q(t)} duplicated: ${fD(k2)}, ${fR(s2, e2)}`)
    : sameDay ? L(`${q(t)} jetzt ${fR(s2, e2)}`, `${q(t)} now ${fR(s2, e2)}`)
    : L(`${q(t)} verschoben: ${fD(k2)}, ${fR(s2, e2)}`, `${q(t)} moved: ${fD(k2)}, ${fR(s2, e2)}`)) + extra;
  keepView(() => withUndo(msg, () => {
    const r = commitDay(k2, [...plan, nx], lim), nid = r.ids[nx.id] || nx.id;
    if (!copy && !sameDay){ moveLinks(k1, id, k2, nid); commitDay(k1, l1.filter(y => y.id !== id)); }
    ED.sel = { k: k2, id: nid }; ED.dup = null;
  }));
}
// Dauer ändern: Die anliegenden Blocker rücken mit, nichts wird überschrieben, es entsteht keine Lücke
function applyResize(k, id, ns, ne){
  const list = dayList(k), x = list.find(y => y.id === id);
  if (!x || (ns === x.s && ne === x.e)){ keepView(render); return; }
  const others = list.filter(y => y.id !== id), lim = dayLim(list);
  [ns, ne] = fitResize(others, x, ns, ne, lim);
  if (ns === x.s && ne === x.e){ keepView(render); return; }
  const plan = resizePlan(others, x, ns, ne), n = plan.filter((y, i) => y !== others[i]).length;
  const extra = !n ? '' : n === 1 ? L(', 1 Blocker rückt mit', ', 1 block moved along') : L(`, ${n} Blocker rücken mit`, `, ${n} blocks moved along`);
  keepView(() => withUndo(L(`${q(x.p.title)} jetzt ${fR(ns, ne)}`, `${q(x.p.title)} now ${fR(ns, ne)}`) + extra, () => { commitDay(k, [...plan, { ...x, s: ns, e: ne }], lim); ED.sel = { k, id }; }));
}
// Verlängern nur so weit, wie alle Blocker noch in den Tag passen
function fitResize(others, x, ns, ne, lim){
  ns = Math.max(ns, Math.min(lim[0], x.s)); ne = Math.min(ne, Math.max(lim[1], x.e));
  while (ne > x.e && outside(resizePlan(others, x, x.s, ne), lim)) ne = Math.max(x.e, ne - 5);
  while (ns < x.s && outside(resizePlan(others, x, ns, x.e), lim)) ns = Math.min(x.s, ns + 5);
  return [ns, ne];
}
function applyDelete(k, id){
  const list = dayList(k), x = list.find(y => y.id === id); if (!x) return;
  const g = closeGap(list, x), t = x.p.title;
  if (ED.sel && ED.sel.k === k && ED.sel.id === id) ED.sel = null;
  keepView(() => withUndo(g.A ? L(`${q(t)} gelöscht, alles danach ${fmtDur(g.A)} früher`, `${q(t)} deleted, everything after ${fmtDur(g.A)} earlier`) : L(`${q(t)} gelöscht`, `${q(t)} deleted`),
    () => { commitDay(k, g.list); }));
}
// Aufteilen: Schnittlinie setzen, dann teilen. Der untere Teil wird ein eigener Termin.
function cutRange(x){ const st = Math.max(MINP, Math.min(D.set.snap, Math.floor((x.e - x.s) / 2))); return [x.s + st, x.e - st]; }
function startCut(k, id){
  const x = dayList(k).find(y => y.id === id); if (!x) return;
  const [lo, hi] = cutRange(x);
  if (hi < lo){ toast(L('Zu kurz zum Aufteilen.', 'Too short to split.')); return; }
  ED.sel = { k, id }; ED.dup = null; ED.cut = { k, id, at: clamp(snapM((x.s + x.e) / 2), lo, hi) };
  render();
}
function applyCut(){
  const c = ED.cut; if (!c) return;
  const list = dayList(c.k), x = list.find(y => y.id === c.id);
  ED.cut = null;
  if (!x){ render(); return; }
  const [lo, hi] = cutRange(x), at = clamp(c.at, lo, hi), piece = { ...x, id: uid(), s: at, add: true, rt: false };
  keepView(() => withUndo(L(`${q(x.p.title)} um ${fT(at)} aufgeteilt`, `${q(x.p.title)} split at ${fT(at)}`), () => {
    const r = commitDay(c.k, list.map(y => y.id === x.id ? { ...y, e: at } : y).concat(piece));
    ED.sel = { k: c.k, id: r.ids[piece.id] };
  }));
}
// Kontextmenü wie bei iOS (gedrückt halten oder ausgewählten Blocker antippen)
function blockMenu(k, id, pt){
  const o = findOcc(k, id); if (!o) return null;
  const el = blockEl(k, id), r = el ? el.getBoundingClientRect() : null;
  const items = [
    { label: L('Duplizieren', 'Duplicate'), icon: 'copy', fn: () => { ED.dup = { k, id }; ED.sel = ED.cut = null; render(); } },
    { label: L('Aufteilen', 'Split'), icon: 'cutO', fn: () => startCut(k, id) },
    { label: L('To-Do hinzufügen', 'Add to-do'), icon: 'todoAdd', fn: () => todoPicker(k, id) },
    { label: 'Details', icon: 'info', fn: () => openOcc(k, id) },
    '-',
    { label: L('Löschen', 'Delete'), icon: 'trash', danger: true, fn: () => applyDelete(k, id) }
  ];
  if (tmin(o.end) - tmin(o.start) < 2 * MINP) items.splice(1, 1);
  return popMenu({ title: `${o.title} · ${fR(o.start, o.end)}`, items, dim: true, rect: r, x: pt && pt.x, y: pt && pt.y,
    preview: r ? { r, cls: cc(o.color), html: I(o.icon) } : null, onClose: () => { if (!G && ui.tab === 'week') render(); } });
}

/* ---------- Gesten ---------- */
// Während einer Geste: Zeiger festhalten und die Scroll-Position halten. Das Scrollen selbst verhindert
// touchmove (unten). overflow wird bewusst nicht umgeschaltet, das lässt die Ansicht auf iOS leer werden.
let lockY = null;
function capture(g){ try { page.setPointerCapture(g.pid); } catch (e) {} lockScroll(true); }
function lockScroll(on){ lockY = on ? scroller.scrollTop : null; }
scroller.addEventListener('scroll', () => { if (lockY !== null && G && Math.abs(scroller.scrollTop - lockY) > 1) scroller.scrollTop = lockY; }, { passive: true });
// Geste abbrechen, z. B. wenn die App in den Hintergrund geht oder ein Ende nie ankommt
function cancelGesture(){ const g = G; if (g) endG({ pointerId: g.pid }, true); lockScroll(false); stopAuto(); }
page.addEventListener('pointerdown', e => {
  if (G && e.isPrimary && e.pointerId !== G.pid) cancelGesture();   // alte Geste ohne Ende
  if (G || ui.tab !== 'week' || ui.assign || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const t = e.target;
  if (t.closest('.edel')) return;
  const g = { pid: e.pointerId, pt: e.pointerType, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t: Date.now() };
  if (ED.on){
    const h = t.closest('.hdl'), c = t.closest('.cutl'), gh = t.closest('.ghost.pend');
    if (h){ const b = h.closest('.blk'); G = { ...g, kind: 'resize', edge: h.dataset.e, blk: b, k: b.dataset.d, id: b.dataset.id }; startResize(G); e.preventDefault(); return; }
    if (c && ED.cut){ G = { ...g, kind: 'cut' }; capture(G); e.preventDefault(); return; }
    if (gh && ED.dup){ G = { ...g, kind: 'dup0', gh, k: ED.dup.k, id: ED.dup.id }; e.preventDefault(); return; }
    if (ED.cut || ED.dup) return;
  }
  const b = t.closest('.blk');
  if (!b || b.classList.contains('skip')) return;
  G = { ...g, kind: 'press', blk: b, k: b.dataset.d, id: b.dataset.id, sel: ED.on && (b.classList.contains('sel') || e.pointerType === 'mouse') };
  G.timer = setTimeout(onLong, ED.on ? LONG_ED : LONG);
});
function onLong(){
  const g = G; if (!g || g.kind !== 'press') return;
  if (!ED.on){
    // Bearbeiten sofort sichtbar machen, ohne neu zu zeichnen: Der Finger liegt noch auf dem Element
    edEnter(g.k, g.id); g.enter = true; g.kind = 'ready'; lockScroll(true);
    const wk = $('.wk', page); if (wk) wk.classList.add('editing');
    g.blk.classList.add('sel');
    navT.textContent = L('Bearbeiten', 'Edit');
  } else {
    ED.sel = { k: g.k, id: g.id };
    for (const b of page.querySelectorAll('.blk.sel')) if (b !== g.blk) b.classList.remove('sel');
    g.blk.classList.add('sel');
    g.kind = 'menu'; lockScroll(true);
    g.close = blockMenu(g.k, g.id, { x: g.x0, y: g.y0 });
  }
}
window.addEventListener('pointermove', e => {
  const g = G; if (!g || e.pointerId !== g.pid) return;
  g.lx = e.clientX; g.ly = e.clientY;
  const far = Math.hypot(g.lx - g.x0, g.ly - g.y0) > SLOP;
  if (g.kind === 'press'){ if (far){ clearTimeout(g.timer); if (g.sel) startMove(g); else G = null; } return; }   // sonst scrollt die Seite
  if (g.kind === 'ready' || g.kind === 'menu'){ if (far){ if (g.close){ g.close(); g.close = null; } startMove(g); } return; }
  if (g.kind === 'dup0'){ if (Math.hypot(g.lx - g.x0, g.ly - g.y0) > 3) startGhost(g); return; }
  step(g); autoEdge(g);
}, { passive: true });
function endG(e, cancel){
  const g = G; if (!g || e.pointerId !== g.pid) return;
  G = null; clearTimeout(g.timer); stopAuto(); lockScroll(false);
  if (g.kind === 'press') return;
  swallow = Date.now() + 700;
  if (cancel && g.kind !== 'menu'){ cleanG(g); keepView(render); return; }
  if (g.kind === 'ready') keepView(render);
  else if (g.kind === 'move' || g.kind === 'dup') dropMove(g);
  else if (g.kind === 'resize'){ cleanG(g); applyResize(g.k, g.id, g.ns, g.ne); }
}
window.addEventListener('pointerup', e => endG(e, false));
window.addEventListener('pointercancel', e => endG(e, true));
// Sicherheitsnetz: Ist der letzte Finger weg, aber kein pointerup angekommen, die Geste trotzdem beenden
for (const [ev, cancel] of [['touchend', false], ['touchcancel', true]]) document.addEventListener(ev, e => {
  const g = G; if (!g || g.pt !== 'touch' || e.touches.length) return;
  setTimeout(() => { if (G === g) endG({ pointerId: g.pid }, cancel); }, 120);
}, { passive: true });
// Während einer Geste darf die Seite nicht scrollen
document.addEventListener('touchmove', e => { if (G && G.kind !== 'press' && e.cancelable) e.preventDefault(); }, { passive: false });
page.addEventListener('contextmenu', e => { if (ui.tab === 'week' && e.target.closest('.blk')) e.preventDefault(); });
document.addEventListener('pointerdown', () => { swallow = 0; }, true);
document.addEventListener('click', e => { if (swallow && Date.now() < swallow){ swallow = 0; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
function step(g){ if (g.kind === 'move' || g.kind === 'dup') moveTo(g); else if (g.kind === 'resize') resizeTo(g); else if (g.kind === 'cut') cutTo(g); }
function cleanG(g){
  clearTimeout(g.holdT); g.ins = null;
  if (g.cmap) for (const k of g.cmap.keys()) showPlan(g, k, null);   // ausgewichene Blocker zurück an ihren Platz
  const wk = $('.wk', page); if (wk) wk.classList.remove('drag');
  if (g.ghost) g.ghost.remove(); if (g.bub) g.bub.remove(); if (g.blk) g.blk.classList.remove('moving'); g.ghost = g.bub = null;
}
function bubble(g, text, cx, y){
  const b = g.bub; b.textContent = text;
  const w = b.offsetWidth, W = g.wb.clientWidth;
  b.style.left = `${clamp(cx, w / 2 + 4, Math.max(w / 2 + 4, W - w / 2 - 4))}px`; b.style.top = `${y}px`;
}
function makeGhost(g, o){
  g.wb = $('.wk-b', page);
  g.ghost = document.createElement('div'); g.ghost.className = `ghost ${cc(o.color)}`; g.ghost.innerHTML = I(o.icon);
  g.ghost.style.height = `${Math.max((g.e0 - g.s0) * PPM, MINH) - 2}px`;
  g.bub = document.createElement('div'); g.bub.className = 'tbub glass';
  g.wb.append(g.ghost, g.bub);
  const wk = $('.wk', page); if (wk) wk.classList.add('drag');
}
// Verschieben: Kopie folgt dem Finger, Ziel rastet an Tag und Raster ein, die anderen Blocker weichen live aus
const HOLD_IN = 800;   // so lange über einem Blocker halten, um hineinzulegen
function startMove(g){
  const o = findOcc(g.k, g.id), el = g.blk;
  if (!o || !el || !el.isConnected){ G = null; keepView(render); return; }
  g.kind = 'move'; g.s0 = tmin(o.start); g.e0 = tmin(o.end);
  g.offM = (g.y0 - el.getBoundingClientRect().top) / PPM;
  el.classList.add('moving');
  makeGhost(g, o); capture(g); moveTo(g);
}
function startGhost(g){
  const o = findOcc(g.k, g.id); if (!o){ G = null; return; }
  g.kind = 'dup'; g.copy = true; g.s0 = tmin(o.start); g.e0 = tmin(o.end);
  g.offM = (g.y0 - g.gh.getBoundingClientRect().top) / PPM;
  g.gh.style.visibility = 'hidden';
  makeGhost(g, o); capture(g); moveTo(g);
}
// Die anderen Blocker einer Spalte (ohne den bewegten) mit ihren Elementen, einmal pro Geste gelesen
function colOf(g, k){
  if (!g.cmap) g.cmap = new Map();
  let c = g.cmap.get(k);
  if (!c){
    const el = [...page.querySelectorAll('.wk-c')].find(x => x.dataset.d === k);
    const l = dayList(k).filter(y => g.copy || k !== g.k || y.id !== g.id);
    c = { list: l, lim: dayLim(l), els: new Map(el ? [...el.querySelectorAll('.blk')].map(b => [b.dataset.id, b]) : []) };
    g.cmap.set(k, c);
  }
  return c;
}
// Vorschau: plan = neue Lage der anderen Blocker (null = wie gespeichert)
function showPlan(g, k, plan){
  const c = colOf(g, k), at = plan ? new Map(plan.map(y => [y.id, y])) : null;
  const dur = g.e0 - g.s0, lim = g.s2 != null ? [Math.min(c.lim[0], g.s2), Math.max(c.lim[1], g.s2 + dur)] : c.lim;
  for (const y of c.list){
    const el = c.els.get(y.id); if (!el) continue;
    const n = (at && at.get(y.id)) || y;
    el.style.top = `${WK.Y(n.s)}px`;
    el.classList.toggle('covered', n.s < lim[0] || n.e > lim[1]);   // fiele aus dem Tag
    el.classList.toggle('tgt', !!(g.ins && g.ins.k === k && g.ins.id === y.id));
  }
}
// Beim Hineinlegen: Start innerhalb des Ziel-Blockers, ohne winzige Reste davor oder danach
function insPos(t, dur, raw){
  const st = D.set.snap, c = [t.s, t.e - dur];
  for (let m = t.s + st; m < t.e - dur; m += st) c.push(m);
  let best = t.s, bd = Infinity;
  for (const m of c){
    const h = m - t.s, tl = t.e - dur - m;
    if ((h && h < MINP) || (tl && tl < MINP) || Math.abs(m - raw) >= bd) continue;
    bd = Math.abs(m - raw); best = m;
  }
  return best;
}
function moveTo(g){
  const col = colAt(g.lx); if (!col) return;
  const k = col.dataset.d, dur = g.e0 - g.s0, lo = WK.H0 * 60, hi = Math.max(lo, Math.min(WK.H1 * 60, DAY_END) - dur);
  const raw = yToMin(g.ly) - g.offM, M = 14 / PPM;
  // Hineinlegen endet, wenn die Mitte des Blockers den Ziel-Blocker deutlich verlässt
  if (g.ins && (g.ins.k !== k || raw + dur / 2 < g.ins.s - M || raw + dur / 2 > g.ins.e + M)){ g.ins = null; g.hold = null; }
  const s = g.ins ? insPos(g.ins, dur, raw) : clamp(snapFrom(g.s0, raw), lo, hi);
  const c = colOf(g, k), home = k === g.k && s === g.s0 && !g.copy;
  if (g.pk && g.pk !== k) showPlan(g, g.pk, null);
  g.pk = k; g.k2 = k; g.s2 = s;
  showPlan(g, k, g.ins || home ? null : pushAside(c.list, s, s + dur).list);
  const l = col.offsetLeft, w = col.offsetWidth, pad = g.ins ? 7 : 2;
  Object.assign(g.ghost.style, { left: `${l + pad}px`, width: `${w - 2 * pad}px`, top: `${WK.Y(s)}px` });
  g.ghost.classList.toggle('in', !!g.ins);
  const tt = g.ins ? g.ins.p.title : '', name = tt.length > 14 ? tt.slice(0, 13) + '…' : tt;
  bubble(g, (g.ins ? `${L('In', 'Into')} ${name} · ` : g.k2 !== g.k ? WD_S()[wdOf(g.k2) - 1] + ' · ' : '') + fR(s, s + dur), l + w / 2, WK.Y(s) - 4);
  if (!g.ins) holdCheck(g, c, s, dur);
}
// Lange über der Mitte eines anderen Blockers halten, dann darf der bewegte in ihn hinein (er wird dort geteilt)
function holdCheck(g, c, s, dur){
  const mid = s + dur / 2, t = c.list.find(y => { const q4 = (y.e - y.s) / 4; return dur <= y.e - y.s && mid >= y.s + q4 && mid <= y.e - q4; });
  const id = t ? g.k2 + '|' + t.id : null;
  if (id && g.hold === id && !autoV && Math.hypot(g.lx - g.hx, g.ly - g.hy) <= 10) return;
  clearTimeout(g.holdT); g.hold = id; g.hx = g.lx; g.hy = g.ly;
  if (!t || autoV) return;   // nicht während automatisch gescrollt wird
  const k = g.k2;
  g.holdT = setTimeout(() => {
    if (G !== g || g.hold !== id || g.ins) return;
    g.ins = { ...t, k }; moveTo(g);
  }, HOLD_IN);
}
function dropMove(g){
  const into = g.ins ? g.ins.id : null;
  cleanG(g);
  if (g.k2 == null){ keepView(render); return; }
  const unchanged = g.k2 === g.k && g.s2 === g.s0;
  if (g.copy && unchanged){ if (g.gh) g.gh.style.visibility = ''; return; }   // Kopie nur angetippt
  if (unchanged){ if (g.enter) keepView(render); return; }
  placeMove(g.k, g.id, g.k2, g.s2, !!g.copy, into);
}
// Dauer an den Griffen ändern, mit Vorschau auf die Nachbarn
function startResize(g){
  const list = dayList(g.k), x = list.find(y => y.id === g.id);
  if (!x){ G = null; return; }
  g.s0 = g.ns = x.s; g.e0 = g.ne = x.e;
  g.off = yToMin(g.y0) - (g.edge === 'top' ? x.s : x.e);   // Kante bewegt sich mit dem Finger, springt nicht zu ihm
  g.others = list.filter(y => y.id !== g.id); g.x = x; g.lim = dayLim(list);
  g.cols = new Map([...g.blk.parentElement.querySelectorAll('.blk:not(.skip)')].map(b => [b.dataset.id, b]));
  g.wb = $('.wk-b', page);
  g.bub = document.createElement('div'); g.bub.className = 'tbub glass'; g.wb.appendChild(g.bub);
  capture(g); resizeTo(g);
}
function resizeTo(g){
  const m = yToMin(g.ly) - g.off, mn = Math.max(MINP, Math.min(D.set.snap, 15)), Y = WK.Y;
  if (g.edge === 'top') g.ns = clamp(snapFrom(g.s0, m), g.lim[0], g.e0 - mn);
  else g.ne = clamp(snapFrom(g.e0, m), g.s0 + mn, g.lim[1]);
  [g.ns, g.ne] = fitResize(g.others, g.x, g.ns, g.ne, g.lim);
  Object.assign(g.blk.style, { top: `${Y(g.ns)}px`, height: `${Math.max((g.ne - g.ns) * PPM, MINH) - 2}px` });
  // Vorschau: Die Nachbarn rücken live mit
  const plan = resizePlan(g.others, g.x, g.ns, g.ne);
  plan.forEach(n => {
    const el = g.cols.get(n.id); if (!el) return;
    el.classList.remove('covered');
    el.style.top = `${Y(Math.max(n.s, WK.H0 * 60))}px`; el.style.height = `${Math.max((n.e - Math.max(n.s, WK.H0 * 60)) * PPM, MINH) - 2}px`;
  });
  const col = g.blk.parentElement;
  bubble(g, fR(g.ns, g.ne), col.offsetLeft + col.offsetWidth / 2, Y(g.edge === 'top' ? g.ns : g.ne) - 30);
}
function cutTo(g){
  const c = ED.cut; if (!c) return;
  const x = dayList(c.k).find(y => y.id === c.id); if (!x) return;
  const [lo, hi] = cutRange(x);
  c.at = clamp(snapM(yToMin(g.ly)), lo, hi);
  const el = blockEl(c.k, c.id), cl = el && $('.cutl', el);
  if (cl){ cl.style.top = `${(c.at - Math.max(x.s, WK.H0 * 60)) * PPM}px`; const b = $('.tbub', cl); if (b) b.textContent = fT(c.at); }
}
// Automatisch scrollen, wenn der Finger an den oberen oder unteren Rand kommt
let autoV = 0, autoR = 0;
function autoEdge(g){
  const hd = $('.wk-h', page); if (!hd) return;
  const top = hd.getBoundingClientRect().bottom, bar = $('.edbar', edbar), Z = 56;
  const bot = Math.min(tabsEl.getBoundingClientRect().top, bar ? bar.getBoundingClientRect().top : innerHeight);
  autoV = g.ly < top + Z ? -Math.min(18, Math.ceil((top + Z - g.ly) / Z * 12)) : g.ly > bot - Z ? Math.min(18, Math.ceil((g.ly - bot + Z) / Z * 12)) : 0;
  if (autoV && !autoR) autoR = requestAnimationFrame(autoTick);
}
function autoTick(){
  autoR = 0;
  if (!G || !autoV) return;
  const before = scroller.scrollTop;
  scroller.scrollTop += autoV;
  if (lockY !== null) lockY = scroller.scrollTop;
  if (scroller.scrollTop !== before){ onScroll(); step(G); }
  autoR = requestAnimationFrame(autoTick);
}
function stopAuto(){ autoV = 0; if (autoR) cancelAnimationFrame(autoR); autoR = 0; }
