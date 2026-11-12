
/* ================= Sheets ================= */
// Detail eines Blockers: Name, Beschreibung, wann er sich wiederholt, To-Dos, „Bearbeiten“ und „Ausfallen lassen“
function nextDate(b, after){
  for (let i = 1; i <= 21; i++){ const k = addD(after, i), o = b.days.includes(wdOf(k)) ? findOcc(k, b.id) : null; if (o && !o.skipped) return o; }
  return null;
}
function repeatCard(o){
  const b = o.extra ? o.base : slotById(o.id), wd = wdOf(o.date);
  let label;
  if (!b) label = L('Einmalig, nur an diesem Tag', 'One-off, this day only');
  else if (o.extra) label = L(`Extra-Termin. Sonst ${daysLabel(b.days)}, ${fR(b.start, b.end)}`, `Extra session. Usually ${daysLabel(b.days)}, ${fR(b.start, b.end)}`);
  else label = `${daysLabel(b.days)} · ${fR(b.start, b.end)}`;
  const nx = b ? nextDate(b, o.date) : null;
  return `<div class="rep ${cc(o.color)}"><div class="rl">${I(b ? 'repeat' : 'calendar')}<span>${esc(label)}</span></div>`
    + (b ? `<div class="wdots">${wdOrder().map(d => `<span class="${b.days.includes(d) ? 'on' : ''}${d === wd ? ' now' : ''}">${WD_1()[d - 1]}</span>`).join('')}</div>` : '')
    + (nx ? `<div class="rn">${L('Nächstes Mal', 'Next time')}: ${rel(nx.date, { wd: 'long' })}, ${fT(nx.start)}</div>` : '') + `</div>`;
}
function openOcc(date, id){
  const body = () => {
    const o = findOcc(date, id); if (!o) return null;
    const items = todoItems(o);
    let h = `<div class="dh">${tile(o, 'lg')}<div style="min-width:0"><div class="dt">${esc(o.title)}</div><div class="ds">${rel(date, { wd: 'long' })} · ${fR(o.start, o.end)}</div>`;
    if (o.skipped) h += `<span class="skiptag">${L('Fällt an diesem Tag aus', 'Skipped on this day')}</span>`;
    else if (o.extra) h += `<span class="edtag">${L('Nur an diesem Tag', 'This day only')}</span>`;
    else if (o.edited) h += `<span class="edtag">${L('An diesem Tag geändert', 'Changed on this day')}</span>`;
    h += `</div></div>`;
    if (o.desc) h += `<div class="desc">${esc(o.desc)}</div>`;
    h += repeatCard(o);
    // Jedes To-Do ist direkt beschreibbar: einmalige ändern den Text, wiederkehrende nur für diesen Tag
    h += `<div class="gh">To-Dos</div><div class="grp tdo ${cc(o.color)}">`;
    h += items.map(it => `<div class="cell"><button class="ck${it.done ? ' on' : ''}" data-a="tg" data-k="${it.kind}" data-id="${esc(it.id)}" aria-label="${L('Erledigt', 'Done')}">${I('check', 'cm')}</button>${prioMark(it.prio)}`
      + `<input class="fi tdi${it.done ? ' dn' : ''}" name="${it.kind}:${esc(it.id)}" value="${esc(it.title)}" maxlength="200" autocomplete="off" enterkeyhint="done" data-enter="blur" aria-label="${L('To-Do', 'To-do')}">`
      + (it.kind === 'r' ? `<span class="rpi${it.ch ? ' ch' : ''}" title="${it.ch ? L('Nur an diesem Tag geändert', 'Changed for this day only') : L('Bei jedem Termin', 'Every time')}">${I('repeat')}</span>` : '')
      + `<button class="ib" data-a="tmore" data-k="${it.kind}" data-id="${esc(it.id)}" aria-label="${L('Mehr', 'More')}">${I('more')}</button></div>`).join('');
    const hid = (o.rt || []).filter(r => { const x = rtoOf(date, id, r.id); return x && x.x; }).length;
    if (hid) h += `<button class="cell tap" data-a="rtBack"><span class="cg muted">${L(hid === 1 ? '1 wiederkehrendes To-Do ist hier entfernt' : `${hid} wiederkehrende To-Dos sind hier entfernt`, hid === 1 ? '1 recurring to-do removed here' : `${hid} recurring to-dos removed here`)}</span><span class="nb">${L('Zurückholen', 'Restore')}</span></button>`;
    if (!o.skipped) h += `<button class="cell tap tint" data-a="addTd">${I('plus')}<span class="cg">${L('To-Do hinzufügen', 'Add to-do')}</span></button>`;
    else if (!items.length) h += `<div class="cell"><span class="cg muted">${L('Keine To-Dos', 'No to-dos')}</span></div>`;
    h += `</div>`;
    if (items.length) h += `<div class="gf">${L('Text antippen zum Ändern. Wiederkehrende To-Dos ändern sich dabei nur für diesen Tag.', 'Tap the text to change it. Recurring to-dos only change for this day.')}</div>`;
    h += `<div class="mt"><button class="abtn tint" data-a="edit">${I('pencil')}${L('Bearbeiten', 'Edit')}</button>`;
    h += o.skipped ? `<button class="abtn soft" data-a="unskip">${I('undo')}${L('Wieder einplanen', 'Plan again')}</button>` : `<button class="abtn red" data-a="skip">${I('skip')}${L('An diesem Tag ausfallen lassen', 'Skip on this day')}</button>`;
    return h + `</div>`;
  };
  const first = body(); if (first === null) return;
  const upd = () => { save(); refreshAll(); };
  const S = sheet({ float: true, body: first, onInput: (name, v, el, ev) => { if (ev === 'change') editItem(name, v, el); }, on: {
    edit: () => slotEditor({ mode: 'occ', date, id }),
    skip: () => {
      const o = findOcc(date, id); if (!o) return;
      S.close();
      const when = date === today() ? L('heute', 'today') : L(`am ${fD(date, { wd: false })}`, `on ${fD(date, { wd: false })}`);
      if (o.extra) withUndo(L(`${q(o.title)} ${when} entfernt`, `${q(o.title)} removed ${when}`), () => { const v = D.ov[date]; if (!v) return false; v.x = v.x.filter(s => s.id !== id); cleanOv(date); unassign(t => t.at.date === date && t.at.slot === id); });
      else withUndo(L(`${q(o.title)} fällt ${when} aus`, `${q(o.title)} skipped ${when}`), () => { ensureOs(date, id).skip = 1; });
    },
    unskip: () => { const r = D.ov[date] && D.ov[date].s[id]; if (r){ delete r.skip; cleanOv(date); } upd(); },
    tg: el => { const k = el.dataset.k, iid = el.dataset.id; if (k === 'r'){ checkRt(date, id, iid, !rtDone(date, id, iid)); upd(); } else { el.classList.add('on'); const c = el.closest('.cell'); if (c) c.classList.add('bye'); setTimeout(() => doneTodo(iid), 260); } },
    blur: el => el.blur(),
    tmore: el => itemMenu(el),
    rtBack: () => { const m = D.rto[date] && D.rto[date][id]; if (m) for (const rid of Object.keys(m)) setRto(date, id, rid, { x: 0 }); upd(); },
    addTd: () => todoPicker(date, id)
  } });
  // Text übernehmen, sobald das Feld verlassen wird. Das Sheet wird dabei nicht neu gezeichnet,
  // damit ein Tippen auf einen anderen Knopf im selben Moment nicht verloren geht.
  function editItem(name, v, el){
    const m = /^([tr]):(.+)$/.exec(name); if (!m) return;
    const val = v.trim().slice(0, 200);
    if (m[1] === 't'){
      const t = D.todos.find(x => x.id === m[2]); if (!t) return;
      if (!val){ el.value = t.title; return; }
      if (val === t.title) return;
      t.title = val;
    } else {
      const o = findOcc(date, id), r = o && (o.rt || []).find(x => x.id === m[2]); if (!r) return;
      const cur = rtoOf(date, id, r.id);
      if (!val){ el.value = (cur && cur.t) || r.title; return; }
      if (val === ((cur && cur.t) || r.title)) return;
      setRto(date, id, r.id, { t: val === r.title ? null : val });
      const ic = el.parentNode && el.parentNode.querySelector('.rpi'); if (ic) ic.classList.toggle('ch', val !== r.title);
    }
    save(); render();
  }
  const focusItem = (kind, iid) => { const i = S.el.querySelector(`input[name="${kind}:${CSS.escape(iid)}"]`); if (i){ i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) {} } };
  // „…“ an einem To-Do: ändern, auslagern (neu zuordnen oder in die Übersicht), Priorität, löschen
  function itemMenu(el){
    const kind = el.dataset.k, iid = el.dataset.id, o = findOcc(date, id); if (!o) return;
    const out = then => {   // aus dem Blocker nehmen; then(todoId)
      if (kind === 't'){ const t = D.todos.find(x => x.id === iid); if (!t) return; t.at = null; save(); refreshAll(); then(t.id); return; }
      const it = todoItems(o).find(x => x.kind === 'r' && x.id === iid); if (!it) return;
      const t = newTodo(it.title, null);
      D.todos.push(t); setRto(date, id, iid, { x: 1 }); if (it.done) checkRt(date, id, iid, false);
      save(); refreshAll(); then(t.id);
    };
    const items = [{ label: kind === 'r' ? L('Nur hier umbenennen', 'Rename here only') : L('Umbenennen', 'Rename'), icon: 'pencil', fn: () => focusItem(kind, iid) }];
    if (kind === 'r'){ const x = rtoOf(date, id, iid); if (x && x.t) items.push({ label: L('Original-Text zurück', 'Restore original text'), icon: 'undo', fn: () => { setRto(date, id, iid, { t: null }); upd(); } }); }
    if (kind === 't'){ const t = D.todos.find(x => x.id === iid); items.push({ label: L('Priorität', 'Priority'), icon: 'flag', fn: () => popMenu({ anchor: el, items: PRIO().map(([p, l]) => ({ label: l, check: (t.prio || 0) === p, fn: () => { const tt = D.todos.find(x => x.id === iid); if (tt){ tt.prio = p; upd(); } } })) }) }); }
    items.push('-',
      { label: L('Auslagern und neu zuordnen', 'Move out and reassign'), icon: 'wstart', fn: () => out(tid => { closeSheets(); startAssign(tid); }) },
      { label: L('Auslagern in die Übersicht', 'Move out to the list'), icon: 'share', fn: () => out(() => toast(L('Liegt jetzt in der To-Do-Übersicht', 'Now in your to-do list'))) },
      '-');
    if (kind === 't') items.push({ label: L('Löschen', 'Delete'), icon: 'trash', danger: true, fn: () => withUndo(L('To-Do gelöscht', 'To-do deleted'), () => { const n = D.todos.length; D.todos = D.todos.filter(x => x.id !== iid); if (D.todos.length === n) return false; }) });
    else {
      items.push({ label: L('Nur hier entfernen', 'Remove here only'), icon: 'trash', danger: true, fn: () => withUndo(L('An diesem Tag entfernt', 'Removed for this day'), () => { setRto(date, id, iid, { x: 1 }); checkRt(date, id, iid, false); }) });
      const b = o.extra ? o.base : slotById(o.id);
      if (b) items.push({ label: L('Bei jedem Termin entfernen', 'Remove every time'), icon: 'trash', danger: true, fn: async () => {
        if (!await ask({ title: L('Bei jedem Termin entfernen?', 'Remove every time?'), msg: L(`Das To-Do verschwindet aus ${q(b.title)} in deiner Master-Woche.`, `The to-do disappears from ${q(b.title)} in your master week.`), ok: L('Entfernen', 'Remove'), danger: true })) return;
        withUndo(L('Aus der Master-Woche entfernt', 'Removed from your master week'), () => { const live = slotById(b.id); if (!live) return false; live.rt = live.rt.filter(r => r.id !== iid); });
      } });
    }
    popMenu({ anchor: el, items });
  }
  S.refresh = () => { const b = body(); if (b === null) S.close(); else S.set(b); };
}

// Blocker anlegen oder bearbeiten. mode: tpl = Master-Woche, occ = ein Termin, newWeek = neuer Blocker aus der Woche
const NEW_COLORS = ['blue', 'orange', 'green', 'purple', 'red', 'teal', 'indigo', 'pink', 'yellow', 'mint', 'brown', 'cyan'];
function freeStart(busy, from, dur){
  let t = from;
  for (const [s, e] of busy.slice().sort((a, b) => a[0] - b[0])){ if (s - t >= dur) break; if (e > t) t = e; }
  return clamp(t, 0, DAY_END - dur);
}
function slotEditor(cfg){
  const mode = cfg.mode;
  let base = null, o = null, canScope = false, scope = 'week';
  if (mode === 'tpl'){ if (cfg.slotId){ base = slotById(cfg.slotId); if (!base) return; } }
  else if (mode === 'occ'){ o = findOcc(cfg.date, cfg.id); if (!o) return; if (o.extra) scope = 'day'; else { base = slotById(o.id); if (!base) return; canScope = true; scope = 'day'; } }
  else { canScope = true; scope = 'day'; }
  const week = mode === 'newWeek' ? (cfg.week || weekKeys(wkStart(cfg.day || today()))) : null;
  const src = o || base, isNew = !src, dur = D.set.dur;
  let st = Math.max(dayS(), 8 * 60);
  if (isNew){
    const k = cfg.day || null, wd = k ? wdOf(k) : wdOf(today());
    const busy = (k ? occ(k).filter(x => !x.skipped) : D.slots.filter(s => s.days.includes(wd))).map(x => [tmin(x.start), tmin(x.end)]);
    let from = Math.max(dayS(), 8 * 60); if (k && k === today()) from = Math.max(from, Math.ceil((nowMin() + 1) / 15) * 15);
    st = freeStart(busy, Math.min(from, DAY_END - dur), dur);
  }
  const f = src ? { title: src.title, desc: src.desc || '', start: src.start, end: src.end, color: src.color, icon: src.icon, days: base ? [...base.days] : [], rt: base ? clone(base.rt || []) : [], auto: false }
    : { title: '', desc: '', start: fmtT(st), end: fmtT(Math.min(st + dur, DAY_END)), color: NEW_COLORS[D.slots.length % NEW_COLORS.length], icon: 'time', days: [wdOf(cfg.day || today())], rt: [], auto: true };
  f.day = cfg.day || cfg.date || null; f.look = false; f.nrt = '';
  const dayWord = () => !f.day ? '' : f.day === today() ? L('heute', 'today') : L(`am ${fD(f.day, { wd: false })}`, `on ${fD(f.day, { wd: false })}`);
  const durTxt = () => { if (!isTime(f.start) || !isTime(f.end)) return ''; const d = tmin(f.end) - tmin(f.start); return d > 0 ? fmtDur(d) : L('Ende vor Beginn', 'Ends before start'); };
  const lookHTML = () => `<div class="grp dis${f.look ? ' open' : ''}" id="look" style="margin-top:14px"><button class="dh2" data-a="look"><span class="tile ${cc(f.color)}" data-tile>${I(f.icon)}</span><span class="cg">${L('Farbe & Symbol', 'Color & symbol')}<span class="cs" id="lname">${esc(colName(f.color))}</span></span>${CHEV}</button><div class="db"><div>`
    + `<div class="subh">${L('Farbe', 'Color')}</div><div class="cols">${COLORS.map(([k]) => `<button class="${cc(k)}${f.color === k ? ' on' : ''}" data-a="color" data-v="${k}" aria-label="${esc(colName(k))}"></button>`).join('')}<label class="${f.color[0] === '#' ? 'on ' + cc(f.color) : ''}" aria-label="${L('Eigene Farbe', 'Custom color')}"><input type="color" name="ccol" value="${f.color[0] === '#' ? f.color : '#ff6a00'}"></label></div>`
    + ICAT.map(([, de, en, keys]) => `<div class="subh">${L(de, en)}</div><div class="icons ${cc(f.color)}">${keys.map(k => `<button class="${f.icon === k ? 'on' : ''}" data-a="icon" data-v="${k}" aria-label="${k}">${I(k)}</button>`).join('')}</div>`).join('')
    + `</div></div></div>`;
  const body = () => {
    let h = '';
    if (canScope){
      const a = mode === 'newWeek' ? L('Nur an einem Tag', 'One day only') : L(`Nur ${dayWord()}`, `Only ${dayWord()}`);
      h += `<div class="seg" style="margin-top:4px"><button class="${scope === 'day' ? 'on' : ''}" data-a="scope" data-v="day">${a}</button><button class="${scope === 'week' ? 'on' : ''}" data-a="scope" data-v="week">${L('Jede Woche', 'Every week')}</button></div>`
        + `<div class="gf">${scope === 'day' ? L('Gilt nur für diesen Tag. Deine Master-Woche bleibt, wie sie ist.', 'Applies to this day only. Your master week stays as it is.') : mode === 'newWeek' ? L('Kommt in deine Master-Woche und gilt jede Woche.', 'Goes into your master week and repeats every week.') : L('Ändert deine Master-Woche für jede Woche.', 'Changes your master week for every week.')}</div>`;
    }
    if (mode === 'newWeek' && scope === 'day') h += `<div class="grp" style="margin-top:14px"><div class="daypick">${week.map(k => `<button class="${k === f.day ? 'on' : ''}" data-a="pday" data-v="${k}">${WD_S()[wdOf(k) - 1]}<b>${pd(k).getDate()}</b></button>`).join('')}</div></div>`;
    h += `<div class="grp" style="margin-top:${canScope ? 14 : 4}px"><div class="cell"><button class="tile ${cc(f.color)}" data-tile data-a="look" aria-label="${L('Farbe und Symbol', 'Color and symbol')}">${I(f.icon)}</button><input class="fi" name="title" value="${esc(f.title)}" placeholder="${L('Name, z. B. Arbeit oder Sport', 'Name, e.g. Work or Gym')}" maxlength="80" autocomplete="off" enterkeyhint="done"></div>`
      + `<div class="cell" style="align-items:flex-start"><textarea class="fi" name="desc" rows="2" placeholder="${L('Beschreibung (optional)', 'Description (optional)')}" maxlength="600">${esc(f.desc)}</textarea></div></div>`;
    h += lookHTML();
    h += `<div class="gh">${L('Zeit', 'Time')}</div><div class="grp"><div class="cell"><span class="cg">${L('Beginn', 'Starts')}</span><input type="time" name="start" value="${f.start}" required></div><div class="cell"><span class="cg">${L('Ende', 'Ends')}</span><input type="time" name="end" value="${f.end}" required></div><div class="cell"><span class="cg muted">${L('Dauer', 'Duration')}</span><span class="cv" id="edur">${durTxt()}</span></div></div>`;
    if (scope === 'week'){
      h += `<div class="gh">${L('Wiederholen', 'Repeat')}</div><div class="grp"><div class="days">${wdOrder().map(d => `<button class="${f.days.includes(d) ? 'on' : ''}" data-a="day" data-v="${d}" aria-label="${WD_L()[d - 1]}">${WD_S()[d - 1]}</button>`).join('')}</div>`
        + `<div class="presets"><button data-a="preset" data-v="1,2,3,4,5">${L('Mo–Fr', 'Mon–Fri')}</button><button data-a="preset" data-v="6,7">${L('Wochenende', 'Weekends')}</button><button data-a="preset" data-v="1,2,3,4,5,6,7">${L('Täglich', 'Daily')}</button></div></div>`;
      h += `<div class="gh">${L('To-Dos bei jedem Termin', 'To-dos every time')}</div><div class="grp">${f.rt.map((r, i) => `<div class="cell"><span class="ck dash"></span><input class="fi" name="rt${i}" value="${esc(r.title)}" maxlength="200" autocomplete="off"><button class="ib" data-a="delRt" data-i="${i}" aria-label="${L('Entfernen', 'Remove')}">${I('x')}</button></div>`).join('')}`
        + `<div class="cell"><span class="tile sm green">${I('plus')}</span><input class="fi" name="nrt" value="${esc(f.nrt)}" placeholder="${L('Neues To-Do, z. B. Tasche packen', 'New to-do, e.g. pack your bag')}" maxlength="200" autocomplete="off" enterkeyhint="done" data-enter="addRt"><button class="nb" data-a="addRt">${L('Hinzufügen', 'Add')}</button></div></div>`
        + `<div class="gf">${L('Erscheinen bei jedem Termin dieses Blockers zum Abhaken.', 'They show up every time this block happens, ready to check off.')}</div>`;
    }
    if (mode === 'occ' && o.edited) h += `<div class="mt"><button class="abtn soft" data-a="reset">${I('undo')}${L('Auf Master-Woche zurücksetzen', 'Reset to master week')}</button></div>`;
    if (mode === 'occ' && o.extra) h += `<div class="mt"><button class="abtn red" data-a="delx">${I('trash')}${L('Diesen Termin löschen', 'Delete this session')}</button></div>`;
    if (mode === 'tpl' && base) h += `<div class="mt"><button class="abtn red" data-a="del">${I('trash')}${L('Blocker löschen', 'Delete block')}</button></div>`;
    return h;
  };
  const rerender = () => S.set(body());
  // Farbe und Symbol ändern, ohne das Formular neu zu zeichnen (Dropdown bleibt offen)
  const lookUI = () => {
    const cls = cc(f.color);
    for (const t of S.el.querySelectorAll('[data-tile]')){ t.className = `tile ${cls}`; t.innerHTML = I(f.icon); }
    const ln = $('#lname', S.el); if (ln) ln.textContent = colName(f.color);
    for (const b of S.el.querySelectorAll('.cols button')) b.classList.toggle('on', b.dataset.v === f.color);
    const lab = $('.cols label', S.el); if (lab) lab.className = f.color[0] === '#' ? 'on ' + cls : '';
    for (const g of S.el.querySelectorAll('.icons')) g.className = 'icons ' + cls;
    for (const b of S.el.querySelectorAll('.icons button')) b.classList.toggle('on', b.dataset.v === f.icon);
  };
  const save2 = () => {
    const title = f.title.trim();
    const bad = (msg, sel) => { toast(msg); const g = sel && $(sel, S.el), gg = g && g.closest('.grp'); if (gg){ gg.classList.add('shake'); setTimeout(() => gg.classList.remove('shake'), 400); } };
    if (!title) return bad(L('Bitte gib einen Namen ein.', 'Please enter a name.'), '[name=title]');
    if (!isTime(f.start) || !isTime(f.end)) return bad(L('Bitte Beginn und Ende angeben.', 'Please set a start and an end.'), '[name=start]');
    if (tmin(f.end) <= tmin(f.start)) return bad(L('Das Ende muss nach dem Beginn liegen. Über Mitternacht: zwei Blocker anlegen.', 'The end must be after the start. Over midnight: create two blocks.'), '[name=end]');
    if (scope === 'week' && !f.days.length) return bad(L('Wähle mindestens einen Wochentag.', 'Pick at least one weekday.'), '.days');
    const vals = { title: title.slice(0, 80), desc: f.desc.trim().slice(0, 600), start: f.start, end: f.end, color: f.color, icon: f.icon };
    const days = [...f.days].sort((a, b) => a - b), rt = f.rt.filter(r => r.title.trim()).map(r => ({ id: r.id, title: r.title.trim().slice(0, 200) }));
    if (f.nrt.trim()) rt.push({ id: uid(), title: f.nrt.trim().slice(0, 200) });
    let added = null;
    if (mode === 'tpl'){
      if (base){ const live = slotById(base.id); if (!live){ S.close(); return; } Object.assign(live, vals, { days, rt }); }
      else D.slots.push({ id: uid(), ...vals, days, rt });
    } else if (mode === 'occ' && o.extra){
      const x = D.ov[cfg.date] && D.ov[cfg.date].x.find(s => s.id === o.id);
      if (x){ const b = x.src ? slotById(x.src) : null; Object.assign(x, vals); if (b && x.desc === b.desc) x.desc = ''; }
    } else if (mode === 'occ'){
      const live = slotById(base.id); if (!live){ S.close(); return; }
      if (scope === 'day'){
        const e = {}; for (const k of FIELDS) if (!same(vals[k], live[k] ?? '')) e[k] = vals[k];
        const r = ensureOs(cfg.date, live.id); if (Object.keys(e).length) r.e = e; else delete r.e;
        cleanOv(cfg.date);
      } else {
        Object.assign(live, vals, { days, rt });
        const r = D.ov[cfg.date] && D.ov[cfg.date].s[live.id]; if (r){ delete r.e; cleanOv(cfg.date); }
      }
    } else if (scope === 'day'){ const id = uid(); ensureOv(f.day).x.push({ id, ...vals }); added = { k: f.day, id }; }
    else {
      const id = uid(); D.slots.push({ id, ...vals, days, rt });
      const k = days.includes(wdOf(f.day)) ? f.day : week.find(x => days.includes(wdOf(x))); if (k) added = { k, id };
    }
    if (added && cfg.onAdd) cfg.onAdd(added.k, added.id);
    save(); S.close(); refreshAll();
    if (mode === 'tpl' && !base) toast(L(`${q(vals.title)} ist jetzt in deiner Master-Woche`, `${q(vals.title)} is now in your master week`));
  };
  const S = sheet({ title: isNew ? L('Neuer Blocker', 'New block') : mode === 'tpl' ? L('Blocker bearbeiten', 'Edit block') : L('Bearbeiten', 'Edit'),
    rightLabel: isNew ? L('Hinzufügen', 'Add') : L('Sichern', 'Save'), body: body(), onRight: save2,
    onInput: (name, v) => {
      if (name === 'title'){ f.title = v; if (f.auto){ const s = suggestIcon(v); if (s && s !== f.icon){ f.icon = s; lookUI(); } } }
      else if (name === 'desc') f.desc = v;
      else if (name === 'nrt') f.nrt = v;
      else if (name === 'start' || name === 'end'){ f[name] = v; const d = $('#edur', S.el); if (d) d.textContent = durTxt(); }
      else if (name === 'ccol'){ if (HEX.test(v)){ f.color = v.toLowerCase(); lookUI(); } }
      else if (/^rt\d+$/.test(name)){ const r = f.rt[+name.slice(2)]; if (r) r.title = v; }
    },
    on: {
      scope: el => { scope = el.dataset.v; if (scope === 'week' && !f.days.length) f.days = base ? [...base.days] : [wdOf(f.day || today())]; rerender(); },
      pday: el => { f.day = el.dataset.v; rerender(); },
      look: () => { f.look = !f.look; const d = $('#look', S.el); if (d) d.classList.toggle('open', f.look); },
      color: el => { f.color = el.dataset.v; lookUI(); },
      icon: el => { f.icon = el.dataset.v; f.auto = false; lookUI(); },
      day: el => { const v = +el.dataset.v; f.days = f.days.includes(v) ? f.days.filter(x => x !== v) : [...f.days, v]; rerender(); },
      preset: el => { f.days = el.dataset.v.split(',').map(Number); rerender(); },
      addRt: () => { const v = f.nrt.trim(); if (!v){ const i = $('[name=nrt]', S.el); if (i) i.focus(); return; } f.rt.push({ id: uid(), title: v }); f.nrt = ''; rerender(); const n = $('[name=nrt]', S.el); if (n) n.focus(); },
      delRt: el => { f.rt.splice(+el.dataset.i, 1); rerender(); },
      reset: () => { const r = D.ov[cfg.date] && D.ov[cfg.date].s[o.id]; if (r){ delete r.e; cleanOv(cfg.date); } save(); S.close(); refreshAll(); toast(L('Wieder wie in der Master-Woche', 'Back to your master week')); },
      delx: () => { S.close(); withUndo(L(`${q(o.title)} gelöscht`, `${q(o.title)} deleted`), () => { const v = D.ov[cfg.date]; if (!v) return false; v.x = v.x.filter(s => s.id !== o.id); cleanOv(cfg.date); unassign(t => t.at.date === cfg.date && t.at.slot === o.id); }); },
      del: () => { S.close(); withUndo(L(`${q(base.title)} gelöscht`, `${q(base.title)} deleted`), () => { D.slots = D.slots.filter(s => s.id !== base.id); for (const k of Object.keys(D.ov)){ delete D.ov[k].s[base.id]; cleanOv(k); } unassign(t => t.at.slot === base.id); }); }
    } });
  if (isNew) setTimeout(() => { const t = $('[name=title]', S.el); if (t && !('ontouchstart' in window)) t.focus(); }, 350);
}

// Ferien: ausgewählte Blocker in einem Zeitraum ausfallen lassen
function rangeSkipSheet(){
  const t = today(), f = { from: t, to: addD(t, 13), ids: new Set() };
  const list = () => D.slots.slice().sort((a, b) => tmin(a.start) - tmin(b.start) || a.title.localeCompare(b.title, LANG));
  const count = () => { let n = 0; if (f.to < f.from || diffD(f.from, f.to) > 365) return 0; for (let k = f.from; k <= f.to; k = addD(k, 1)) for (const s of D.slots) if (f.ids.has(s.id) && s.days.includes(wdOf(k))) n++; return n; };
  const W = n => LANG === 'en' ? (n === 1 ? '1 week' : `${n} weeks`) : (n === 1 ? '1 Woche' : `${n} Wochen`);
  const body = () => {
    const l = list(), n = count();
    let h = `<div class="gh" style="margin-top:4px">${L('Zeitraum', 'Period')}</div><div class="grp"><div class="cell"><span class="cg">${L('Von', 'From')}</span><input type="date" name="from" value="${f.from}"></div><div class="cell"><span class="cg">${L('Bis', 'To')}</span><input type="date" name="to" value="${f.to}"></div></div>`
      + `<div class="presets" style="padding:12px 4px 0">${[1, 2, 3, 6].map(w => `<button data-a="len" data-v="${w * 7}">${W(w)}</button>`).join('')}</div>`;
    h += `<div class="gh">${L('Was fällt aus?', 'What is skipped?')}</div><div class="grp">`;
    if (l.length) h += `<button class="cell tap tint" data-a="all"><span class="cg">${f.ids.size === l.length ? L('Keine auswählen', 'Select none') : L('Alle auswählen', 'Select all')}</span></button>`;
    h += l.map(s => `<button class="cell tap" data-a="tg" data-id="${esc(s.id)}">${tile(s)}<span class="cg"><span class="ct">${esc(s.title)}</span><span class="cs">${fR(s.start, s.end)} · ${daysLabel(s.days)}</span></span><span class="ck gray${f.ids.has(s.id) ? ' on' : ''}" style="--c:var(--tint)">${I('check', 'cm')}</span></button>`).join('')
      || `<div class="cell"><span class="cg muted">${L('Deine Master-Woche ist noch leer.', 'Your master week is still empty.')}</span></div>`;
    h += `</div><div class="gf">${f.to < f.from ? L('Das Ende liegt vor dem Beginn.', 'The end is before the start.') : n ? L(`${n} Termine fallen aus. Danach gilt automatisch wieder deine Master-Woche.`, `${n} sessions are skipped. After that your master week applies again automatically.`) : L('Wähle aus, was in diesem Zeitraum ausfällt.', 'Choose what is skipped in this period.')}</div>`;
    return h;
  };
  const S = sheet({ title: L('Ferien & freie Tage', 'Holidays & days off'), rightLabel: L('Übernehmen', 'Apply'), body: body(),
    onInput: (name, v, el, ev) => { if ((name === 'from' || name === 'to') && ev === 'change' && isKey(v)){ const len = diffD(f.from, f.to); f[name] = v; if (name === 'from' && f.to < f.from) f.to = addD(v, Math.max(len, 0)); S.set(body()); } },
    on: {
      len: el => { f.to = addD(f.from, +el.dataset.v - 1); S.set(body()); },
      all: () => { const l = list(); if (f.ids.size === l.length) f.ids.clear(); else l.forEach(s => f.ids.add(s.id)); S.set(body()); },
      tg: el => { const id = el.dataset.id; if (f.ids.has(id)) f.ids.delete(id); else f.ids.add(id); S.set(body()); }
    },
    onRight: () => {
      if (f.to < f.from){ toast(L('Das Ende liegt vor dem Beginn.', 'The end is before the start.')); return; }
      if (diffD(f.from, f.to) > 365){ toast(L('Bitte höchstens ein Jahr auf einmal.', 'Please at most one year at a time.')); return; }
      if (!f.ids.size){ toast(L('Wähle mindestens einen Blocker.', 'Pick at least one block.')); return; }
      const n = count();
      S.close();
      withUndo(L(`${n} Termine fallen aus`, `${n} sessions skipped`), () => { for (let k = f.from; k <= f.to; k = addD(k, 1)) for (const s of D.slots) if (f.ids.has(s.id) && s.days.includes(wdOf(k))) ensureOs(k, s.id).skip = 1; });
    } });
}

function todoSheet(id){
  const t = D.todos.find(x => x.id === id); if (!t) return;
  const f = { title: t.title, note: t.note, due: t.due, at: t.at ? { ...t.at } : null, prio: t.prio || 0 };
  const body = () => {
    const o = f.at ? (() => { const x = findOcc(f.at.date, f.at.slot); return x && !x.skipped ? x : null; })() : null;
    return `<div class="grp" style="margin-top:4px"><div class="cell"><input class="fi" name="title" value="${esc(f.title)}" placeholder="${L('Titel', 'Title')}" maxlength="200" autocomplete="off"></div><div class="cell" style="align-items:flex-start"><textarea class="fi" name="note" placeholder="${L('Notiz', 'Note')}" maxlength="4000" style="min-height:80px">${esc(f.note)}</textarea></div></div>
    <div class="gh">${L('Priorität', 'Priority')}</div><div class="seg">${PRIO().map(([p, l]) => `<button class="${f.prio === p ? 'on' : ''}" data-a="prio" data-v="${p}">${p ? `<span class="prio p${p}">${'!'.repeat(p)}</span> ` : ''}${l}</button>`).join('')}</div>
    <div class="gh">${L('Planung', 'Planning')}</div><div class="grp">
      <button class="cell tap" data-a="pick">${o ? tile(o) : `<span class="tile">${I('wstart')}</span>`}<span class="cg"><span class="ct">${L('Blocker', 'Block')}</span><span class="cs${f.at && !o ? ' warn' : ''}">${o ? `${rel(o.date)} · ${fT(o.start)} · ${esc(o.title)}` : f.at ? L('Fällt aus, neu wählen', 'Skipped, choose again') : L('Noch keiner', 'None yet')}</span></span>${CHEV}</button>
      ${f.at ? `<button class="cell tap tint" data-a="unpick"><span class="cg">${L('Vom Blocker lösen', 'Remove from block')}</span></button>` : ''}
      <div class="cell"><span class="tile orange">${I('alarm')}</span><span class="cg">${L('Fällig am', 'Due')}</span><input type="date" name="due" value="${f.due || ''}">${f.due ? `<button class="ib" data-a="nodue" aria-label="${L('Datum entfernen', 'Remove date')}">${I('x')}</button>` : ''}</div>
    </div>
    <div class="gf">${L('Mit Blocker erscheint das To-Do genau dort zum Abhaken.', 'With a block, the to-do shows up right there to check off.')}</div>
    <div class="mt"><button class="abtn tint" data-a="done">${I('check')}${L('Erledigt', 'Done')}</button><button class="abtn red" data-a="del">${I('trash')}${L('To-Do löschen', 'Delete to-do')}</button></div>`;
  };
  // Übernehmen (ohne zu schließen). false = Titel fehlt
  const commit = () => {
    const title = f.title.trim(); if (!title){ toast(L('Bitte gib einen Titel ein.', 'Please enter a title.')); return false; }
    const live = D.todos.find(x => x.id === id); if (!live) return null;
    Object.assign(live, { title: title.slice(0, 200), note: f.note.replace(/\s+$/, ''), due: f.due, at: f.at, prio: f.prio });
    save(); return true;
  };
  const S = sheet({ title: 'To-Do', body: body(),
    onInput: (name, v, el, ev) => { if (name === 'due'){ if (ev === 'change'){ f.due = isKey(v) ? v : null; S.set(body()); } } else if (name === 'title' || name === 'note') f[name] = v; },
    onRight: () => { const r = commit(); if (r === false) return; S.close(); refreshAll(); },
    on: {
      // Blocker wählen: Die Wochenansicht öffnet sich, ein Tipp auf einen Blocker ordnet zu
      pick: () => { const r = commit(); if (r === false) return; closeSheets(); if (r) startAssign(id); else refreshAll(); },
      unpick: () => { f.at = null; S.set(body()); },
      nodue: () => { f.due = null; S.set(body()); },
      done: () => { if (commit() === false) return; S.close(); doneTodo(id); },
      prio: el => { f.prio = +el.dataset.v; S.set(body()); },
      del: () => { S.close(); withUndo(L('To-Do gelöscht', 'To-do deleted'), () => { D.todos = D.todos.filter(x => x.id !== id); }); }
    } });
}

// Blocker für ein To-Do auswählen (nächste 14 Tage oder ein Datum)
function slotPicker(cur, cb){
  const t = today();
  let d = cur && cur.date >= t ? cur.date : t;
  const body = () => {
    const days = [...Array(14)].map((_, i) => addD(t, i)), n = nowMin(), list = occ(d).filter(o => !o.skipped);
    let h = `<div class="chips">${days.map((x, i) => `<button class="chip${x === d ? ' on' : ''}" data-a="d" data-d="${x}">${i === 0 ? L('Heute', 'Today') : i === 1 ? L('Morgen', 'Tomorrow') : WD_S()[wdOf(x) - 1]}<b>${pd(x).getDate()}</b></button>`).join('')}</div>`;
    h += `<div class="grp" style="margin-top:12px"><div class="cell"><span class="cg">${L('Anderes Datum', 'Other date')}</span><input type="date" name="date" value="${d}"></div></div>`;
    h += `<div class="gh">${fD(d, { wd: 'long' })}</div><div class="grp">`;
    h += list.map(o => { const sel = cur && cur.date === d && cur.slot === o.id, past = d === t && tmin(o.end) <= n; return `<button class="cell tap${sel ? ' sel' : ''}" data-a="pick" data-id="${esc(o.id)}">${tile(o)}<span class="cg"><span class="ct">${esc(o.title)}</span><span class="cs">${fR(o.start, o.end)}${past ? L(' · schon vorbei', ' · already over') : ''}</span></span>${sel ? `<span style="color:var(--tint);display:flex">${I('check')}</span>` : ''}</button>`; }).join('')
      || `<div class="cell"><span class="cg muted">${L('Keine Blocker an diesem Tag.', 'No blocks on this day.')}</span></div>`;
    h += `</div>`;
    if (cur) h += `<div class="mt"><button class="abtn red" data-a="clear">${L('Vom Blocker lösen', 'Remove from block')}</button></div>`;
    return h;
  };
  const S = sheet({ title: L('Blocker wählen', 'Choose a block'), body: body(),
    onInput: (name, v, el, ev) => { if (name === 'date' && ev === 'change' && isKey(v)){ d = v; S.set(body()); } },
    on: {
      d: el => { d = el.dataset.d; S.set(body()); },
      pick: el => { S.close(); cb({ date: d, slot: el.dataset.id }); },
      clear: () => { S.close(); cb(null); }
    } });
  setTimeout(() => { const on = $('.chip.on', S.el); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 60);
}

// To-Do an einen Termin hängen: nur dieses Mal oder bei jedem Termin des Blockers
function todoPicker(date, id){
  const o0 = findOcc(date, id); if (!o0) return;
  const xr = o0.extra ? (D.ov[date] && D.ov[date].x.find(x => x.id === id)) : null;
  const base = o0.extra ? (xr && xr.rt && o0.base ? o0.base : null) : slotById(id);
  let every = false, draft = '';
  const when = date === today() ? L('heute', 'today') : L(`am ${fD(date, { wd: false })}`, `on ${fD(date, { wd: false })}`);
  const body = () => {
    const open = D.todos.filter(t => !t.done && !(t.at && t.at.date === date && t.at.slot === id));
    let h = '';
    if (base) h += `<div class="seg" style="margin-top:4px"><button class="${every ? '' : 'on'}" data-a="ev" data-v="0">${L('Nur dieses Mal', 'Just this time')}</button><button class="${every ? 'on' : ''}" data-a="ev" data-v="1">${L('Bei jedem Termin', 'Every time')}</button></div>`
      + `<div class="gf">${every ? L(`Erscheint ab jetzt bei jedem Termin von ${q(base.title)}.`, `Shows up every time ${q(base.title)} happens.`) : L(`Nur ${when} bei ${q(o0.title)}.`, `Only ${when} at ${q(o0.title)}.`)}</div>`;
    h += `<div class="grp" style="margin-top:${base ? 14 : 4}px"><div class="cell"><span class="ck dash"></span><input class="fi" name="nt" value="${esc(draft)}" placeholder="${L('Neues To-Do', 'New to-do')}" maxlength="200" autocomplete="off" enterkeyhint="done" data-enter="add"><button class="nb" data-a="add">${L('Hinzufügen', 'Add')}</button></div></div>`;
    if (!every && open.length) h += `<div class="gh">${L('Offene To-Dos', 'Open to-dos')}</div><div class="grp">${open.map(t => { const o = atOcc(t); return `<button class="cell tap" data-a="pick" data-id="${t.id}"><span class="cg"><span class="ct">${esc(t.title)}</span>${o ? `<span class="cs">${L('Bisher', 'Currently')}: ${rel(o.date)} · ${fT(o.start)} ${esc(o.title)}</span>` : ''}</span><span class="tile sm green">${I('plus')}</span></button>`; }).join('')}</div><div class="gf">${L('Antippen, um das To-Do diesem Blocker zuzuordnen.', 'Tap to assign the to-do to this block.')}</div>`;
    else if (every && base.rt.length) h += `<div class="gh">${L('Schon dabei', 'Already there')}</div><div class="grp">${base.rt.map(r => `<div class="cell"><span class="ck dash"></span><span class="cg">${esc(r.title)}</span><span class="ib">${I('repeat')}</span></div>`).join('')}</div>`;
    return h;
  };
  const S = sheet({ title: L('To-Do hinzufügen', 'Add to-do'), body: body(),
    onInput: (name, v) => { if (name === 'nt') draft = v; },
    on: {
      ev: el => { every = el.dataset.v === '1'; S.set(body()); },
      pick: el => { const t = D.todos.find(x => x.id === el.dataset.id); if (t){ t.at = { date, slot: id }; save(); refreshAll(); } S.close(); },
      add: () => {
        const v = draft.trim(); if (!v){ const i = $('[name=nt]', S.el); if (i) i.focus(); return; }
        if (every){ const b = slotById(base.id); if (b) b.rt.push({ id: uid(), title: v.slice(0, 200) }); }
        else D.todos.push(newTodo(v.slice(0, 200), { date, slot: id }));
        save(); refreshAll(); S.close();
        toast(every ? L(`Kommt jetzt bei jedem Termin von ${q(base.title)}`, `Now shows up every time ${q(base.title)} happens`) : L('To-Do hinzugefügt', 'To-do added'));
      }
    } });
}
