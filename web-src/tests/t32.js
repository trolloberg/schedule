// Tests für 3.2: Datenübernahme ohne Änderung der Master-Woche, Wochen-Wischen mit Glas-Übergang,
// To-Dos im Blocker (bearbeiten, nur heute ändern, löschen, auslagern), Productivity-Statistik, Wochenbewertung, Montags-Banner
const { chromium } = require('playwright');
const URL = 'http://localhost:8099/stundenplan/';
let pass = 0, fail = 0;
const ok = (c, n, extra = '') => { if (c) pass++; else { fail++; console.log('FAIL:', n, extra); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const cdp = await ctx.newCDPSession(p);
  const W = ms => p.waitForTimeout(ms);
  const SH = '/tmp/claude-0/shots33/';
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  async function swipe(x0, y0, x1, y1, steps = 8, end = true){ await touch('touchStart', x0, y0); for (let i = 1; i <= steps; i++){ await touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await W(16); } if (end) await touch('touchEnd'); }
  const top = '.layer:last-of-type';
  const tap = async (sel, ms = 350) => { await p.click(sel); await W(ms); };
  const D = () => p.evaluate(() => JSON.parse(localStorage.getItem('sp.data.v1')));
  await p.addInitScript(() => {
    window.__off = +(sessionStorage.getItem('off') || 0); const RD = Date;
    class FD extends RD { constructor(...a){ if (a.length) super(...a); else super(RD.now() + window.__off); } static now(){ return RD.now() + window.__off; } }
    window.Date = FD;
  });

  /* ---------- 1: Datenübernahme von 3.1 (v3) ---------- */
  // Eine echte 3.1-Woche mit Abweichungen, Haken und To-Dos anlegen und mit 3.2 laden
  const v3 = {
    v: 3,
    slots: [
      { id: 'a1', title: 'Arbeit', desc: '', start: '08:00', end: '16:00', days: [1, 2, 3, 4, 5], color: 'blue', icon: 'briefcase', rt: [] },
      { id: 's1', title: 'Sport', desc: 'Gym', start: '17:00', end: '18:30', days: [1, 3, 5], color: 'green', icon: 'barbell', rt: [{ id: 'r1', title: 'Dehnen' }, { id: 'r2', title: 'Shake' }] },
      { id: 'l1', title: 'Lernen', desc: '', start: '19:00', end: '20:30', days: [1, 2, 3, 4, 5, 6, 7], color: 'indigo', icon: 'book', rt: [{ id: 'r3', title: 'Karteikarten' }] }
    ],
    ov: {}, chk: {}, todos: [{ id: 't1', title: 'Steuer', note: '', done: false, doneAt: null, due: null, at: null, created: 1 }],
    set: { theme: 'light', lang: 'de', clock: '24', ws: 1, snap: 15, dur: 60, push: { on: 0, url: '', lead: 0 }, tut: 3 }
  };
  await p.goto(URL); await W(300);
  await p.evaluate(v => { localStorage.clear(); localStorage.setItem('sp.data.v1', JSON.stringify(v)); }, v3);
  await p.reload(); await W(700);
  let d = await D();
  ok(d.v === 5, 'Daten auf v5 gehoben', d.v);
  const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v);
  ok(canon(d.slots) === canon(v3.slots), 'Master-Woche bleibt inhaltlich gleich', JSON.stringify(d.slots));
  ok(d.todos[0].prio === 0 && d.rto && d.rev, 'neue Felder ergänzt');
  ok(await p.evaluate(() => !!localStorage.getItem('sp.backup.v3')), 'Rohdaten von 3.1 als Sicherung behalten');
  ok(await p.locator('#tabs [data-t="prod"] span').innerText() === 'Productivity', 'Reiter heißt Productivity');
  ok(await p.locator('#tabs [data-t="todo"]').count() === 0, 'alter To-Do-Reiter ist ersetzt');

  // Zeiten festlegen: Dienstag dieser Woche, 12:00 (so gibt es Vergangenes und Kommendes)
  const setNow = (wd, hh) => p.evaluate(([wd, hh]) => { const n = new Date(); const ws = wkStart(today()); const t = pd(addD(ws, wd - 1)); t.setHours(hh, 0, 0, 0); window.__off += t - n; sessionStorage.setItem('off', String(window.__off)); OCC.clear(); ui.lastToday = today(); ui.week = wkStart(today()); render(); }, [wd, hh]);
  await setNow(2, 12);
  const wk = await p.evaluate(() => weekKeys(wkStart(today())));
  const [mon, tue, wed, thu, fri] = wk;

  /* ---------- 2: Wochen-Wischen ---------- */
  await tap('#tabs [data-t="week"]', 500);
  await p.evaluate(() => { scroller.scrollTop = 300; onScroll(); }); await W(200);
  const w0 = await p.evaluate(() => ui.week);
  // Der Finger zieht die Woche mit
  await swipe(120, 520, 260, 524, 8, false); await W(40);
  const mid = await p.evaluate(() => ({ tr: page.style.transform, op: +page.style.opacity, wsw: page.classList.contains('wsw') }));
  ok(/translate3d\(\d/.test(mid.tr) && mid.op < 1 && mid.op >= .6 && mid.wsw, 'Woche folgt dem Finger', JSON.stringify(mid));
  // Frames während des Übergangs messen
  await p.evaluate(() => { window.__fr = []; let l = performance.now(); const f = t => { window.__fr.push(t - l); l = t; if (window.__fr.length < 60) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await touch('touchEnd'); await W(60);
  const dur = await p.evaluate(() => ({ veil: $('#veil').classList.contains('on'), wt: !!WT }));
  ok(dur.veil && dur.wt, 'Glas-Schleier während des Wechsels', JSON.stringify(dur));
  await W(650);
  const after = await p.evaluate(w0 => ({ back: ui.week === addD(w0, -7), tr: page.style.transform, op: page.style.opacity, cls: page.className, veil: $('#veil').classList.contains('on'), cop: getComputedStyle(page).opacity, kids: page.childElementCount, st: scroller.scrollTop }), w0);
  ok(after.back, 'nach rechts wischen = Woche zurück');
  ok(!after.tr && !after.op && !/wsw|push|pop/.test(after.cls) && !after.veil && after.cop === '1' && after.kids > 0, 'nach dem Wechsel ist alles aufgeräumt', JSON.stringify(after));
  ok(Math.abs(after.st - 300) < 2, 'gleiche Uhrzeit bleibt oben', after.st);
  const fr = await p.evaluate(() => window.__fr.slice(1));
  const long = fr.filter(x => x > 50).length;
  ok(long <= 1, 'Übergang ohne Ruckler (Frames > 50 ms)', `${long} von ${fr.length}, max ${Math.max(...fr).toFixed(0)} ms`);
  console.log('Frames beim Zurück-Wischen: Ø', (fr.reduce((a, x) => a + x, 0) / fr.length).toFixed(1), 'ms, max', Math.max(...fr).toFixed(0), 'ms');
  // Nach links = vor
  await swipe(280, 520, 120, 522); await W(700);
  ok(await p.evaluate(w0 => ui.week === w0, w0), 'nach links wischen = Woche vor');
  // Kurzer Wisch schnappt zurück
  await swipe(200, 520, 230, 522, 6); await W(400);
  ok(await p.evaluate(w0 => ui.week === w0 && !page.style.transform && !page.classList.contains('wsw'), w0), 'kurzer Wisch federt zurück');
  // Senkrecht scrollen wechselt nie die Woche
  await swipe(200, 600, 214, 380, 8); await W(500);
  ok(await p.evaluate(w0 => ui.week === w0 && !page.style.transform, w0), 'senkrechtes Scrollen bleibt in der Woche');
  // Viele schnelle Wechsel hintereinander
  for (let i = 0; i < 6; i++){ await swipe(120, 500, 300, 502, 5); await W(90); }
  await W(800);
  ok(await p.evaluate(w0 => ui.week < w0 && !WT && !page.style.transform && !$('#veil').classList.contains('on') && !!page.firstElementChild, w0), 'schnelle Wechsel enden sauber');
  // Knöpfe nutzen denselben Übergang; Wechsel in den Hintergrund räumt ab
  await p.evaluate(() => A.weekNow()); await W(700);
  ok(await p.evaluate(() => ui.week === wkStart(today())), '"Diese Woche" springt zurück');
  await p.evaluate(() => A.weekNext()); await W(40);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); unstick(); });
  ok(await p.evaluate(() => !WT && !page.style.transform && getComputedStyle(page).opacity === '1' && !$('#veil').classList.contains('on')), 'Aufräumen mitten im Übergang');
  await p.evaluate(() => A.weekNow()); await W(700);
  await p.screenshot({ path: SH + 'v32-week.png' });

  /* ---------- 3: To-Dos im Blocker ---------- */
  const slots0 = JSON.stringify((await D()).slots);
  await p.evaluate(() => { D.todos.push(newTodo('Laufschuhe', { date: addD(wkStart(today()), 2), slot: 's1' })); save(); });
  await p.evaluate(k => openOcc(k, 's1'), wed); await W(600);
  ok(await p.locator('.sheet.float input.tdi').count() === 3, 'Detail zeigt 3 beschreibbare To-Dos');
  await p.screenshot({ path: SH + 'v32-detail.png' });
  // Wiederkehrendes To-Do nur für diesen Tag ändern
  await p.fill('.sheet.float input[name="r:r1"]', 'Dehnen 15 Min.'); await p.press('.sheet.float input[name="r:r1"]', 'Enter'); await W(300);
  d = await D();
  ok(d.rto[wed] && d.rto[wed].s1 && d.rto[wed].s1.r1.t === 'Dehnen 15 Min.', 'Änderung nur für diesen Tag gespeichert', JSON.stringify(d.rto));
  ok(JSON.stringify(d.slots) === slots0, 'Master-Woche unverändert nach Tages-Änderung');
  ok(await p.evaluate(([m, w]) => todoItems(findOcc(m, 's1'))[0].title === 'Dehnen' && todoItems(findOcc(w, 's1'))[0].title === 'Dehnen 15 Min.', [mon, wed]), 'anderer Tag zeigt weiter den Master-Text');
  ok(await p.locator('.sheet.float .rpi.ch').count() === 1, 'Symbol zeigt: nur heute geändert');
  // Einmaliges To-Do umbenennen
  const tid = await p.evaluate(() => D.todos.find(t => t.title === 'Laufschuhe').id);
  await p.fill(`.sheet.float input[name="t:${tid}"]`, 'Neue Laufschuhe'); await p.press(`.sheet.float input[name="t:${tid}"]`, 'Enter'); await W(300);
  ok((await D()).todos.find(t => t.id === tid).title === 'Neue Laufschuhe', 'einmaliges To-Do per Antippen umbenannt');
  // Leerer Text stellt den alten wieder her
  await p.fill(`.sheet.float input[name="t:${tid}"]`, '  '); await p.press(`.sheet.float input[name="t:${tid}"]`, 'Enter'); await W(250);
  ok((await D()).todos.find(t => t.id === tid).title === 'Neue Laufschuhe' && await p.inputValue(`.sheet.float input[name="t:${tid}"]`) === 'Neue Laufschuhe', 'leerer Text löscht nichts');
  // Menü: Auslagern in die Übersicht
  await tap(`.sheet.float [data-a="tmore"][data-id="${tid}"]`, 400);
  const menuTxt = await p.locator('.layer.pl .pop').innerText();
  ok(/Auslagern und neu zuordnen/.test(menuTxt) && /Auslagern in die Übersicht/.test(menuTxt) && /Löschen/.test(menuTxt) && /Priorität/.test(menuTxt), 'Menü mit Auslagern und Löschen', menuTxt);
  await p.click('.layer.pl .pop button:has-text("Auslagern in die Übersicht")'); await W(400);
  ok((await D()).todos.find(t => t.id === tid).at === null, 'Auslagern: To-Do liegt in der Übersicht');
  // Wieder zuordnen und dann wirklich löschen
  await p.evaluate(([id, k]) => { D.todos.find(t => t.id === id).at = { date: k, slot: 's1' }; save(); refreshAll(); }, [tid, wed]); await W(300);
  await tap(`.sheet.float [data-a="tmore"][data-id="${tid}"]`, 400);
  await p.click('.layer.pl .pop button:has-text("Löschen")'); await W(400);
  ok(!(await D()).todos.some(t => t.id === tid), 'Löschen im Blocker entfernt das To-Do ganz (nicht in die Übersicht)');
  await tap('#toast [data-a="_undo"]', 400);
  ok((await D()).todos.some(t => t.id === tid), 'Löschen lässt sich rückgängig machen');
  // Auslagern und neu zuordnen (Picker öffnet sich)
  await p.evaluate(k => { for (const s of stack.slice()) s.close(); }); await W(500);
  await p.evaluate(k => openOcc(k, 's1'), wed); await W(600);
  await tap(`.sheet.float [data-a="tmore"][data-id="${tid}"]`, 400);
  await p.click('.layer.pl .pop button:has-text("Auslagern und neu zuordnen")'); await W(650);
  ok(await p.evaluate(() => ui.tab === 'week' && !!ui.assign && !stack.length), 'Auslagern und neu zuordnen öffnet die Woche zum Antippen');
  await p.evaluate(k => { const b = [...document.querySelectorAll('.blk[data-a="asPick"]')].find(x => x.dataset.d === k); b.click(); }, thu); await W(500);
  d = await D(); const tt = d.todos.find(t => t.id === tid);
  ok(tt.at && tt.at.date === thu, 'neu zugeordnet', JSON.stringify(tt.at));
  await p.evaluate(k => openOcc(k, 's1'), wed); await W(600);
  // Wiederkehrendes nur hier entfernen, dann zurückholen
  await tap('.sheet.float [data-a="tmore"][data-id="r2"]', 400);
  await p.click('.layer.pl .pop button:has-text("Nur hier entfernen")'); await W(400);
  d = await D();
  ok(d.rto[wed].s1.r2.x === 1 && await p.locator('.sheet.float input[name="r:r2"]').count() === 0, 'wiederkehrendes To-Do nur an diesem Tag entfernt');
  ok(JSON.stringify(d.slots) === slots0 && !d.todos.some(t => t.title === 'Shake'), 'dabei weder Master-Woche geändert noch in der Übersicht gelandet');
  await tap('.sheet.float [data-a="rtBack"]', 400);
  ok(!(await D()).rto[wed].s1.r2 && await p.locator('.sheet.float input[name="r:r2"]').count() === 1, 'Zurückholen stellt es wieder her');
  // Wiederkehrendes auslagern: wird ein einmaliges To-Do in der Übersicht
  await tap('.sheet.float [data-a="tmore"][data-id="r2"]', 400);
  await p.click('.layer.pl .pop button:has-text("Auslagern in die Übersicht")'); await W(400);
  d = await D();
  ok(d.todos.some(t => t.title === 'Shake' && !t.at) && d.rto[wed].s1.r2.x === 1, 'wiederkehrendes To-Do ausgelagert');
  ok(JSON.stringify(d.slots) === slots0, 'Master-Woche weiter unverändert');
  // Priorität über das Menü
  await tap(`.sheet.float [data-a="tmore"][data-id="r1"]`, 400);
  ok(!(await p.locator('.layer.pl .pop').innerText()).includes('Priorität'), 'wiederkehrende To-Dos ohne Priorität');
  await p.keyboard.press('Escape'); await p.evaluate(() => { for (const l of document.querySelectorAll('.layer.pl')) l.click(); }); await W(350);
  await p.evaluate(() => { for (const s of stack.slice()) s.close(); }); await W(500);
  // Bei jedem Termin entfernen fragt nach und ändert dann bewusst die Master-Woche
  await p.evaluate(k => openOcc(k, 's1'), fri); await W(600);
  await tap('.sheet.float [data-a="tmore"][data-id="r2"]', 400);
  await p.click('.layer.pl .pop button:has-text("Bei jedem Termin entfernen")'); await W(400);
  ok(await p.locator('.layer.al').count() === 1, 'Nachfrage vor Änderung der Master-Woche');
  await p.click('.layer.al button.d'); await W(500);
  d = await D(); ok(!d.slots.find(s => s.id === 's1').rt.some(r => r.id === 'r2'), 'nach Bestätigung aus der Master-Woche entfernt');
  await tap('#toast [data-a="_undo"]', 400);
  d = await D(); ok(JSON.stringify(d.slots) === slots0, 'rückgängig: Master-Woche wie vorher');
  await p.evaluate(() => { for (const s of stack.slice()) s.close(); }); await W(500);
  // Heute-Ansicht zeigt den geänderten Text des Tages
  await p.evaluate(k => { window.__off += (pd(k) - pd(today())); OCC.clear(); render(); }, wed); await W(200);
  await tap('#tabs [data-t="day"]', 400);
  await p.evaluate(() => dayMode(true)); await W(400);
  ok((await p.locator('#page').innerText()).includes('Dehnen 15 Min.'), 'Heute zeigt den Text für diesen Tag');
  await p.evaluate(() => dayMode(false)); await W(300);
  await p.evaluate(k => { window.__off -= (pd(k) - pd(addD(wkStart(today()), 1))); OCC.clear(); render(); }, wed); await W(200);

  await tap('#tabs [data-t="prod"]', 500);
  let pt;
  /* ---------- 5: To-Dos nach Woche und Priorität ---------- */
  await p.evaluate(([t, n]) => {
    D.todos.push(newTodo('Wichtig', { date: t, slot: 'l1' }, 3), newTodo('Unwichtig', { date: t, slot: 'a1' }, 1), newTodo('Nächste', { date: n, slot: 'l1' }, 0), newTodo('Lose hoch', null, 2));
    save(); render();
  }, [fri, await p.evaluate(f => addD(f, 7), fri)]); await W(300);
  pt = await p.locator('#tdl').innerText();
  const iW = pt.indexOf('Wichtig'), iU = pt.indexOf('Unwichtig'), iN = pt.indexOf('Nächste'), iD = pt.indexOf('DIESE WOCHE'), iNW = pt.indexOf('NÄCHSTE WOCHE'), iO = pt.indexOf('OHNE BLOCKER');
  ok(iD >= 0 && iNW > iD && iO > iNW, 'Gruppen: diese Woche, nächste Woche, ohne Blocker', pt);
  ok(iW < iU && iW > iD && iN > iNW, 'innerhalb der Woche nach Priorität', pt);
  ok((await p.locator('#tdl .prio.p3').count()) >= 1, 'Priorität sichtbar');
  // Priorität im To-Do-Blatt setzen
  const lid = await p.evaluate(() => D.todos.find(t => t.title === 'Unwichtig').id);
  await tap(`[data-a="openTodo"][data-id="${lid}"]`, 600);
  await tap(`${top} [data-a="prio"][data-v="3"]`, 250);
  await tap(`${top} [data-a="_right"]`, 600);
  ok((await D()).todos.find(t => t.id === lid).prio === 3, 'Priorität im To-Do gesetzt');
  await p.screenshot({ path: SH + 'v32-todos.png' });

  /* ---------- 8: Bearbeiten-Modus nimmt Tagestexte mit ---------- */
  await p.evaluate(([w]) => { setRto(w, 's1', 'r1', { t: 'Text X' }); save(); }, [wed]);
  ok(await p.evaluate(([w, t]) => { moveLinks(w, 's1', t, 'zz'); return !!(D.rto[t] && D.rto[t].zz && D.rto[t].zz.r1.t === 'Text X') && !(D.rto[w] && D.rto[w].s1); }, [wed, thu]), 'Verschieben auf anderen Tag nimmt geänderte To-Do-Texte mit');

  ok(!errs.length, 'keine Fehler', errs.join('\n'));
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  console.log(`pass ${pass} fail ${fail}`);
  await b.close();
})();
