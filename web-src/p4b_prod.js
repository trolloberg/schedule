/* ---------- Productivity: erledigte To-Dos und alle offenen To-Dos ---------- */
const PRIO = () => [[0, L('Keine', 'None')], [1, L('Niedrig', 'Low')], [2, L('Mittel', 'Medium')], [3, L('Hoch', 'High')]];
const prioMark = p => p ? `<span class="prio p${p}" aria-label="${L('Priorität', 'Priority')} ${p}">${'!'.repeat(p)}</span>` : '';
const wkLabel = ws => { const n = kw(addD(ws, D.set.ws === 7 ? 1 : 0)); return LANG === 'en' ? `Week ${n}` : `KW ${n}`; };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const ring = (p, c, txt) => `<div class="ring" style="--p:${clamp(p, 0, 100)};--c:${c}"><b>${txt}</b></div>`;

// Diese Woche: erledigt (gezählt, nicht gespeichert) und noch offen in den Blockern ab heute
function weekCount(){
  const t = today(), days = weekKeys(wkStart(t)), done = doneIn(days);
  let open = 0;
  for (const k of days){
    if (k < t) { for (const o of occ(k)) if (!o.skipped) open += todosAt(k, o.id).length; continue; }
    for (const o of occ(k)) if (!o.skipped) for (const it of todoItems(o)) if (!it.done) open++;
  }
  return { done, open };
}
VIEWS.prod = () => {
  const w = weekCount(), all = D.stat.n, td = doneIn([today()]);
  let h = `<h1 class="lt">Productivity</h1>`;
  h += `<div class="kpis">`
    + `<div class="kpi">${ring(pct(w.done, w.done + w.open), 'var(--tint)', w.done + w.open ? `${w.done}<small>/${w.done + w.open}</small>` : '0')}<div class="kl">${L('Diese Woche', 'This week')}</div><div class="ks">${w.done + w.open ? L(`${pct(w.done, w.done + w.open)} % erledigt`, `${pct(w.done, w.done + w.open)}% done`) : L('Noch nichts geplant', 'Nothing planned yet')}</div></div>`
    + `<div class="kpi"><div class="big">${all}</div><div class="kl">${L('Insgesamt erledigt', 'Done in total')}</div><div class="ks">${td ? L(`Heute ${td}`, `Today ${td}`) : L('Heute noch keins', 'None today yet')}</div></div></div>`;
  h += `<div class="gf">${L('Erledigte To-Dos werden nur gezählt und danach gelöscht.', 'Completed to-dos are only counted, then deleted.')}</div>`;
  h += todoPane();
  return { title: 'Productivity', body: h };
};
A.goTodos = () => switchTab('prod');

/* ---------- To-Do einem Blocker zuordnen: Wochenansicht, ein Tipp auf einen Blocker ---------- */
function startAssign(id){
  const t = D.todos.find(x => x.id === id); if (!t) return;
  if (ED.on) edExit(false);
  ui.assign = { id };
  const o = t.at ? atOcc(t) : null;
  ui.week = o ? wkStart(o.date) : wkStart(today());
  if (ui.tab !== 'week') switchTab('week'); else render();
  scrollWeekToNow();
}
A.asPick = el => {
  const a = ui.assign; if (!a) return;
  const o = findOcc(el.dataset.d, el.dataset.id); if (!o || o.skipped) return;
  if (!D.todos.find(x => x.id === a.id)){ ui.assign = null; render(); return; }
  ui.assign = null;
  assignTo(a.id, { date: o.date, slot: o.id });
  switchTab('prod');
};
A.asCancel = () => { ui.assign = null; switchTab('prod'); };

/* ---------- To-Dos (nach Woche und Priorität) ---------- */
function todoPane(){
  return `<div class="grp" style="margin-top:16px"><div class="cell"><span class="ck dash"></span><input class="fi" id="newTodo" placeholder="${L('Neues To-Do', 'New to-do')}" maxlength="200" enterkeyhint="done" autocomplete="off" data-enter="addTodo"><button class="nb" data-a="addTodo">${L('Hinzufügen', 'Add')}</button></div></div><div id="tdl">${todoList()}</div>`;
}
const byPrio = (a, b) => (b.prio || 0) - (a.prio || 0);
function todoList(){
  const cur = wkStart(today()), open = D.todos, un = [], wk = new Map();
  for (const t of open){ const o = atOcc(t); if (o){ const w = wkStart(o.date); if (!wk.has(w)) wk.set(w, []); wk.get(w).push({ t, o }); } else un.push(t); }
  un.sort((a, b) => byPrio(a, b) || (a.due || '9999').localeCompare(b.due || '9999') || a.created - b.created);
  let h = '';
  for (const w of [...wk.keys()].sort()){
    const l = wk.get(w).sort((a, b) => byPrio(a.t, b.t) || a.o.date.localeCompare(b.o.date) || tmin(a.o.start) - tmin(b.o.start) || a.t.created - b.t.created);
    const name = w < cur ? `${L('Verpasst', 'Missed')} · ${wkLabel(w)}` : w === cur ? L('Diese Woche', 'This week') : w === addD(cur, 7) ? L('Nächste Woche', 'Next week') : `${wkLabel(w)} · ${fD(w, { wd: false })}`;
    h += `<div class="gh">${name}<span>${l.length}</span></div><div class="grp">${l.map(x => todoRow(x.t, x.o)).join('')}</div>`;
  }
  if (un.length) h += `<div class="gh">${L('Ohne Blocker', 'No block yet')}<span>${un.length}</span></div><div class="grp">${un.map(t => todoRow(t, null)).join('')}</div>`;
  if (!open.length) h += `<div class="empty"><b>${D.stat.n ? L('Alles erledigt', 'All done') : L('Noch keine To-Dos', 'No to-dos yet')}</b>${D.stat.n ? L('Stark!', 'Nice!') : L('Schreib oben auf, was ansteht. Danach ordnest du jedes To-Do einem Blocker zu.', 'Write down what’s coming up. Then assign each to-do to a block.')}</div>`;
  else if (un.length) h += `<div class="gf">${L(`Tippe auf ${I('wstart', 'xs')} und dann in der Woche auf einen Blocker. Priorität und Notiz setzt du per Antippen.`, `Tap ${I('wstart', 'xs')}, then tap a block in the week. Tap a to-do to set its priority and note.`)}</div>`;
  return h;
}
function todoRow(t, o){
  let sub = '', cls = '';
  if (o){ const d = diffD(today(), o.date); sub = `${rel(o.date)} · ${fT(o.start)} · ${esc(o.title)}`; cls = d < 0 ? 'late' : d === 0 ? 'today' : ''; if (d < 0) sub = L('Verpasst: ', 'Missed: ') + sub; }
  else if (t.at){ sub = L('Blocker fällt aus, neu einplanen', 'Block was cancelled, plan again'); cls = 'warn'; }
  else if (t.due){ const d = diffD(today(), t.due); sub = `${L('Fällig', 'Due')}: ${rel(t.due)}`; cls = d < 0 ? 'late' : d === 0 ? 'today' : ''; }
  if (!sub && t.note) sub = esc(t.note.split('\n')[0]);
  return `<div class="cell" data-row="${t.id}"><button class="ck gray" data-a="todoDone" data-id="${t.id}" aria-label="${L('Erledigt', 'Done')}">${I('check', 'cm')}</button><button class="cg" data-a="openTodo" data-id="${t.id}"><span class="ct">${prioMark(t.prio)}${esc(t.title)}</span>${sub ? `<span class="cs ${cls}">${sub}</span>` : ''}</button><button class="ib t" data-a="assignTodo" data-id="${t.id}" aria-label="${L('Blocker zuweisen', 'Assign block')}">${I('wstart')}</button></div>`;
}
const refreshTodos = () => render();
A.addTodo = () => {
  const inp = $('#newTodo'); if (!inp) return;
  const v = inp.value.trim();
  if (!v){ inp.focus(); return; }
  D.todos.push(newTodo(v.slice(0, 200))); save();
  inp.value = ''; refreshTodos();
  const n = $('#newTodo'); if (n) n.focus();
};
A.todoDone = el => { if (el.dataset.busy) return; el.dataset.busy = '1'; el.classList.add('on'); const c = el.closest('.cell'); if (c) c.classList.add('bye'); setTimeout(() => doneTodo(el.dataset.id), 300); };
A.openTodo = el => todoSheet(el.dataset.id);
A.assignTodo = el => startAssign(el.dataset.id);
// To-Do einem Termin zuordnen (oder mit null lösen) und Bescheid geben
function assignTo(id, at){
  const t = D.todos.find(x => x.id === id); if (!t) return;
  t.at = at; save(); refreshAll();
  if (at){ const o = atOcc(t); if (o) toast(L(`Eingeplant: ${rel(at.date)}, ${fT(o.start)} ${o.title}`, `Planned: ${rel(at.date)}, ${fT(o.start)} ${o.title}`)); }
}
