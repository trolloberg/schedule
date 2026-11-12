// Tests für 3.3: Datenübernahme v4 -> v5, Heute als Fokus mit Countdown, Doppeltipp und angehefteter Blocker,
// erledigte To-Dos werden gezählt und gelöscht, Zuordnen über die Woche, kein weißer Blitz, Punkt nur bei To-Dos,
// kein Verblassen, Tagesbeginn und -ende in den Einstellungen
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
  const tapAt = async (x, y) => { await touch('touchStart', x, y); await W(40); await touch('touchEnd'); };
  const top = '.layer:last-of-type';
  const tap = async (sel, ms = 350) => { await p.click(sel); await W(ms); };
  const D = () => p.evaluate(() => JSON.parse(localStorage.getItem('sp.data.v1')));
  const txt = sel => p.locator(sel).innerText();
  await p.addInitScript(() => {
    window.__off = +(sessionStorage.getItem('off') || 0); const RD = Date;
    class FD extends RD { constructor(...a){ if (a.length) super(...a); else super(RD.now() + window.__off); } static now(){ return RD.now() + window.__off; } }
    window.Date = FD;
  });
  // Uhrzeit setzen: Wochentag wd (1 = Montag) dieser Woche, hh:mm
  const setNow = (wd, hh, mm = 0) => p.evaluate(([wd, hh, mm]) => { const n = new Date(); const ws = wkStart(today()); const t = pd(addD(ws, wd - 1)); t.setHours(hh, mm, 0, 0); window.__off += t - n; sessionStorage.setItem('off', String(window.__off)); OCC.clear(); ui.lastToday = today(); ui.week = wkStart(today()); render(); }, [wd, hh, mm]);

  /* ---------- 1: Datenübernahme von 3.2 (v4) ---------- */
  await p.goto(URL); await W(400);
  await setNow(2, 12);   // Dienstag 12:00
  const wk = await p.evaluate(() => weekKeys(wkStart(today())));
  const [mon, tue, wed] = wk;
  const v4 = {
    v: 4,
    slots: [
      { id: 'a1', title: 'Arbeit', desc: '', start: '08:00', end: '16:00', days: [1, 2, 3, 4, 5], color: 'blue', icon: 'briefcase', rt: [] },
      { id: 's1', title: 'Sport', desc: 'Gym', start: '17:00', end: '18:30', days: [1, 2, 3, 5], color: 'green', icon: 'barbell', rt: [{ id: 'r1', title: 'Dehnen' }, { id: 'r2', title: 'Shake' }] },
      { id: 'l1', title: 'Lernen', desc: '', start: '19:00', end: '20:30', days: [1, 2, 3, 4, 5, 6, 7], color: 'indigo', icon: 'book', rt: [{ id: 'r3', title: 'Karteikarten' }] }
    ],
    ov: { [tue]: { s: { s1: { e: { end: '18:00' } } }, x: [] } },
    chk: { [mon]: { s1: { r1: 1, r2: 1 } }, [tue]: { l1: { r3: 1 } } },
    todos: [
      { id: 't1', title: 'Steuer', note: '', done: false, doneAt: null, due: null, at: null, created: 1, prio: 2 },
      { id: 't2', title: 'Alt erledigt', note: '', done: true, doneAt: Date.now() - 3 * 864e5, due: null, at: null, created: 2, prio: 0 },
      { id: 't3', title: 'Bericht', note: '', done: false, doneAt: null, due: null, at: { date: tue, slot: 'a1' }, created: 3, prio: 1 },
      { id: 't4', title: 'Auch erledigt', note: '', done: true, doneAt: Date.now() - 3600e3, due: null, at: { date: tue, slot: 'a1' }, created: 4, prio: 0 }
    ],
    rto: {}, rev: { [mon]: { m: 4, n: 'gut', l: '', at: 1 } },
    set: { theme: 'light', lang: 'de', clock: '24', ws: 1, snap: 15, dur: 60, push: { on: 0, url: '', lead: 0 }, tut: 3 }
  };
  await p.evaluate(v => { localStorage.clear(); sessionStorage.setItem('off', String(window.__off)); localStorage.setItem('sp.data.v1', JSON.stringify(v)); }, v4);
  await p.reload(); await W(800);
  let d = await D();
  ok(d.v === 5, 'Daten auf v5 gehoben', d.v);
  const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v);
  ok(canon(d.slots) === canon(v4.slots), 'Master-Woche bleibt inhaltlich gleich');
  ok(canon(d.ov) === canon(v4.ov), 'Tagesänderungen bleiben');
  ok(d.todos.map(t => t.id).join() === 't1,t3', 'offene To-Dos bleiben, erledigte sind weg', d.todos.map(t => t.id).join());
  ok(d.todos.every(t => t.done === false), 'kein To-Do ist als erledigt gespeichert');
  ok(d.stat.n === 5, 'Erledigte gezählt: 2 To-Dos + 3 Haken', JSON.stringify(d.stat));
  ok(!d.chk[mon] && d.chk[tue] && d.chk[tue].l1.r3, 'Haken von gestern entfernt, heutige bleiben', JSON.stringify(d.chk));
  ok(d.rev[mon] && d.rev[mon].m === 4, 'alte Bewertungen bleiben in den Daten');
  ok(d.set.dayS === 7 && d.set.dayE === 23, 'Tagesbeginn/-ende mit Standardwerten', d.set.dayS + '-' + d.set.dayE);
  ok(await p.evaluate(() => !!localStorage.getItem('sp.backup.v4')), 'Rohdaten von 3.2 als Sicherung behalten');

  /* ---------- 2: Heute als Fokus ---------- */
  ok(await p.evaluate(() => ui.tab === 'day' && !ui.dayAll), 'Heute startet im Vollbild');
  ok(await p.evaluate(() => appEl.classList.contains('focus') && appEl.classList.contains('c-blue')), 'Hintergrund in der Farbe von Arbeit');
  const bg = await p.evaluate(() => getComputedStyle(appEl).backgroundColor);
  const blueHex = await p.evaluate(() => colHex('blue', false));
  ok(await p.evaluate(() => document.getElementById('themeColor').getAttribute('content')) === blueHex, 'Statusleiste in der Blockfarbe', blueHex);
  ok(/rgb\(0, 122, 255\)|rgb\(0, 1[0-9]{2}, 2[0-9]{2}\)/.test(bg), 'einfarbig blau', bg);
  ok((await txt('.fcs .ft')).includes('Arbeit'), 'Titel des laufenden Blockers');
  ok((await txt('.fcs .fcd')).startsWith('3:59:') || (await txt('.fcs .fcd')).startsWith('4:00:'), 'Countdown 4 Stunden', await txt('.fcs .fcd'));
  const off1 = await p.evaluate(() => parseFloat($('.fring .pg').style.strokeDashoffset));
  ok(Math.abs(off1 - 666 * 0.5) < 3, 'Ring halb abgelaufen (8–16 Uhr, jetzt 12)', off1);
  const c1 = await txt('.fcs .fcd'); await W(1300); const c2 = await txt('.fcs .fcd');
  ok(c1 !== c2, 'Countdown läuft jede Sekunde', c1 + ' -> ' + c2);
  ok(await p.locator('.fglow').count() === 1 && await p.evaluate(() => getComputedStyle($('.fglow')).animationName) === 'breathe', 'Glanz atmet');
  ok((await txt('.fcs .fnx')).includes('Sport'), 'Danach: Sport');
  ok(await p.locator('.fti').count() === 1 && (await txt('.fti')).includes('Bericht'), 'To-Dos des Blockers sichtbar');
  ok(!/weicht ab|Zurücksetzen/i.test(await txt('#page')), 'kein Zurücksetzen-Knopf für heute');
  ok(await p.evaluate(() => !A.resetToday), 'Zurücksetzen-Aktion entfernt');
  await p.screenshot({ path: SH + 'z1-focus.png' });
  // Einmaliges To-Do abhaken: es verschwindet und wird gezählt
  await tap('.fti[data-id="t3"]', 700);
  d = await D();
  ok(!d.todos.some(t => t.id === 't3') && d.stat.n === 6, 'abgehaktes To-Do gelöscht und gezählt', d.stat.n);
  ok(await p.locator('.fti').count() === 0, 'nicht mehr in der Liste');
  ok(await p.locator('#toast [data-a="_undo"]').count() === 1, 'Rückgängig angeboten');
  await tap('#toast [data-a="_undo"]', 400);
  d = await D(); ok(d.todos.some(t => t.id === 't3') && d.stat.n === 5, 'Rückgängig holt es zurück');
  // Vollbild bei 19:30 (Lernen, wiederkehrendes To-Do bleibt abgehakt nur für heute)
  await setNow(2, 19, 30); await W(300);
  ok(await p.evaluate(() => appEl.classList.contains('c-indigo')), 'Farbe wechselt zu Lernen');
  ok(await p.locator('.fti.dn').count() === 1, 'Karteikarten heute schon abgehakt');
  await tap('.fti[data-id="r3"]', 400);
  d = await D(); ok(!(d.chk[tue] && d.chk[tue].l1) && d.stat.n === 4, 'Haken entfernt, Zähler korrigiert', d.stat.n);
  await tap('.fti[data-id="r3"]', 400);
  d = await D(); ok(d.chk[tue].l1.r3 && d.stat.n === 5, 'wieder abgehakt');
  // Zwischen zwei Blockern: Countdown bis zum nächsten
  await setNow(2, 16, 30); await W(300);
  ok(await p.evaluate(() => $('.fcs').dataset.mode) === 'next' && (await txt('.fcs .fcl')).includes('beginnt in'), 'zeigt den nächsten Blocker');
  ok((await txt('.fcs .fcd')).startsWith('30:') || (await txt('.fcs .fcd')).startsWith('29:'), 'Countdown bis 17 Uhr', await txt('.fcs .fcd'));
  ok(await p.evaluate(() => appEl.classList.contains('c-green')), 'Farbe des nächsten Blockers');
  // Nach dem letzten Blocker
  await setNow(2, 22, 0); await W(300);
  ok(await p.evaluate(() => $('.fcs').dataset.mode) === 'off' && (await txt('.fcs .ft')).includes('Feierabend'), 'Feierabend');
  await p.screenshot({ path: SH + 'z2-off.png' });
  await setNow(2, 12, 0); await W(300);

  /* ---------- 3: Doppelt tippen und angehefteter Blocker ---------- */
  const kp = await p.evaluate(() => { const r = $('.fcs .fk').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await tapAt(kp.x, kp.y); await W(500);
  ok(await p.evaluate(() => !ui.dayAll), 'einmal tippen ändert nichts');
  await tapAt(kp.x, kp.y); await W(80); await tapAt(kp.x, kp.y); await W(600);
  ok(await p.evaluate(() => ui.dayAll), 'doppelt tippen zeigt den ganzen Tag');
  ok(await p.evaluate(() => !appEl.classList.contains('focus')), 'Übersicht ohne Vollfarbe');
  ok(await p.locator('.tlr').count() >= 3 && await p.locator('.pin').count() === 1, 'Zeitstrahl und angehefteter Blocker');
  ok((await txt('.pin')).includes('Arbeit') && (await txt('.pin')).includes('noch'), 'angehefteter Blocker zeigt Restzeit');
  await p.evaluate(() => { scroller.scrollTop = 400; onScroll(); }); await W(200);
  const pinTop = await p.evaluate(() => $('.pin').getBoundingClientRect().top);
  ok(pinTop > 40 && pinTop < 80, 'bleibt beim Scrollen oben fixiert', pinTop);
  await p.screenshot({ path: SH + 'z3-overview.png' });
  await tap('.pin', 600);
  ok(await p.evaluate(() => !ui.dayAll && !!$('.fcs')), 'ein Tipp auf den Blocker öffnet wieder das Vollbild');
  await p.evaluate(() => dayMode(true)); await W(400);
  await tap('#tabs [data-t="day"]', 500);
  ok(await p.evaluate(() => !ui.dayAll), 'Heute-Reiter erneut antippen kehrt ins Vollbild zurück');
  // Tippen auf einen Knopf zählt nicht als Doppeltipp
  const fh = await p.evaluate(() => { const r = $('.fadd').getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; });
  await tapAt(fh.x, fh.y); await W(80); await tapAt(fh.x, fh.y); await W(600);
  ok(await p.evaluate(() => !ui.dayAll), 'Doppeltipp auf Knöpfe wechselt nicht');
  await p.evaluate(() => closeSheets()); await W(500);

  /* ---------- 4: Kein weißer Blitz beim Zurückgehen ---------- */
  await p.evaluate(() => { window.__disp = []; new MutationObserver(() => { window.__disp.push(page.style.display + '|' + page.style.visibility); }).observe(page, { attributes: true, attributeFilter: ['style'] }); });
  await tap('#tabs [data-t="set"]', 500);
  await tap('[data-a="go"][data-p="master"]', 600);
  await tap('[data-a="back"]', 150);
  const mid = await p.evaluate(() => ({ h: page.offsetHeight, op: getComputedStyle(page).opacity, kids: page.children.length }));
  await W(500);
  await p.click('.cell[data-a="editTpl"] >> nth=0').catch(() => {});
  await tap('[data-a="go"][data-p="master"]', 600).catch(() => {});
  await p.locator('.cell[data-a="editTpl"]').first().click(); await W(600);
  await tap(`${top} [data-a="_left"]`, 700);
  const disp = await p.evaluate(() => window.__disp);
  ok(!disp.some(x => x.startsWith('none') || x.includes('hidden')), 'Seite wird nie ausgeblendet', disp.join(','));
  ok(mid.h > 300 && mid.kids > 0 && +mid.op > .15, 'beim Zurückgehen bleibt Inhalt sichtbar', JSON.stringify(mid));
  ok(await p.evaluate(() => !page.classList.contains('heal') && !page.style.display), 'Auffrischen räumt sich auf');
  ok(await p.evaluate(() => !/display\s*=\s*'none'|display = "none"/.test(heal.toString())), 'heal ohne display:none');
  await tap('[data-a="back"]', 500);

  /* ---------- 5: Productivity ---------- */
  await tap('#tabs [data-t="prod"]', 500);
  const pt = await txt('#page');
  ok(!/Master-Treue|Abweichung|Wie war|bewerten|Stimmung/.test(pt), 'keine Abweichungs-Analyse und keine Bewertung', pt.slice(0, 200));
  ok(await p.locator('[data-a="pseg"], .rvc, .rvb, [data-a="rvOpen"]').count() === 0, 'keine Segmente, Bewertungs-Karten oder Banner');
  ok(/Insgesamt erledigt/.test(pt) && (await txt('.kpi .big')) === '5', 'Insgesamt erledigt 5', await txt('.kpi .big'));
  ok(!/Erledigt\s*\d/.test(pt) && await p.locator('[data-a="toggleShowDone"]').count() === 0, 'kein Bereich mit erledigten To-Dos');
  await p.screenshot({ path: SH + 'z4-prod.png' });
  // Zuordnen über die Woche, auch in eine spätere Woche
  await tap('[data-a="assignTodo"][data-id="t1"]', 600);
  ok(await p.evaluate(() => ui.tab === 'week' && ui.assign && ui.assign.id === 't1'), 'Wochenansicht im Zuordnen-Modus');
  ok((await txt('#edbar')).includes('Steuer'), 'Hinweis nennt das To-Do');
  ok(await p.evaluate(() => [...document.querySelectorAll('.blk')].every(b => b.dataset.a === 'asPick')), 'Blocker ordnen per Tipp zu');
  await p.screenshot({ path: SH + 'z5-assign.png' });
  await tap('[data-a="weekNext"]', 900);
  const nw = await p.evaluate(() => ui.week);
  ok(nw === await p.evaluate(() => addD(wkStart(today()), 7)), 'Woche vorspringen geht');
  ok(await p.evaluate(() => !!ui.assign) && (await txt('#edbar')).includes('Steuer'), 'Zuordnen bleibt aktiv');
  await p.evaluate(() => { const b = [...document.querySelectorAll('.blk')].find(x => findOcc(x.dataset.d, x.dataset.id).title === 'Lernen'); b.scrollIntoView({ block: 'center' }); }); await W(200);
  const lb = await p.evaluate(() => { const b = [...document.querySelectorAll('.blk')].find(x => findOcc(x.dataset.d, x.dataset.id).title === 'Lernen'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: b.dataset.d }; });
  await p.touchscreen.tap(lb.x, lb.y); await W(700);
  d = await D(); const t1 = d.todos.find(t => t.id === 't1');
  ok(t1.at && t1.at.date === lb.d && t1.at.slot === 'l1' && lb.d > wk[6], 'in der nächsten Woche eingeplant', JSON.stringify(t1.at));
  ok(await p.evaluate(() => ui.tab === 'prod' && !ui.assign), 'zurück in Productivity');
  ok(/nächste woche/i.test(await txt('#tdl')), 'gruppiert unter Nächste Woche', await txt('#tdl'));
  ok((await txt('#toast')).includes('Eingeplant'), 'Bestätigung');
  // Abbrechen und Reiterwechsel beenden das Zuordnen
  await tap('[data-a="assignTodo"][data-id="t1"]', 600);
  ok(await p.evaluate(() => ui.week) === nw, 'öffnet die Woche des aktuellen Blockers');
  await tap('#edbar [data-a="asCancel"]', 500);
  ok(await p.evaluate(() => !ui.assign && ui.tab === 'prod'), 'Abbrechen');
  await tap('[data-a="assignTodo"][data-id="t3"]', 600);
  await tap('#tabs [data-t="set"]', 400);
  ok(await p.evaluate(() => !ui.assign), 'Reiterwechsel beendet das Zuordnen');
  await tap('#tabs [data-t="week"]', 500);
  ok(await p.locator('#edbar .edbar').count() === 0 && await p.evaluate(() => [...document.querySelectorAll('.blk')].every(b => b.dataset.a === 'openOcc')), 'Woche wieder normal');
  ok(await p.locator('[data-a="edStart"]').count() === 1, 'Bearbeiten wieder da');
  // To-Do-Blatt: Blocker wählen öffnet die Woche, Erledigt löscht und zählt
  await tap('#tabs [data-t="prod"]', 400);
  await tap('[data-a="openTodo"][data-id="t1"]', 600);
  ok(await p.locator(`${top} .sw[data-a="done"]`).count() === 0 && await p.locator(`${top} .abtn[data-a="done"]`).count() === 1, 'Erledigt ist ein Knopf, kein Schalter');
  await p.fill(`${top} [name=title]`, 'Steuer 2026'); await W(100);
  await tap(`${top} [data-a="pick"]`, 700);
  ok(await p.evaluate(() => ui.tab === 'week' && ui.assign && ui.assign.id === 't1' && !stack.length), 'Blocker wählen über die Woche');
  d = await D(); ok(d.todos.find(t => t.id === 't1').title === 'Steuer 2026', 'Titel vorher übernommen');
  await tap('#edbar [data-a="asCancel"]', 500);
  await tap('[data-a="openTodo"][data-id="t1"]', 600);
  await tap(`${top} [data-a="done"]`, 700);
  d = await D(); ok(!d.todos.some(t => t.id === 't1') && d.stat.n === 6, 'Erledigt im Blatt löscht und zählt', d.stat.n);
  ok(await p.evaluate(() => !JSON.stringify(D.todos).includes('"done":true')), 'nirgends ein erledigtes To-Do gespeichert');

  /* ---------- 6: Punkt nur bei To-Dos, kein Verblassen ---------- */
  await tap('#tabs [data-t="week"]', 500);
  await p.evaluate(() => { ui.week = wkStart(today()); render(); }); await W(300);
  const cls = await p.evaluate(([tue]) => Object.fromEntries([...document.querySelectorAll('.blk')].filter(b => b.dataset.d === tue).map(b => [findOcc(b.dataset.d, b.dataset.id).title, b.className])), [tue]);
  ok(/\btd\b/.test(cls.Arbeit), 'Arbeit (mit To-Do) hat den Punkt', cls.Arbeit);
  ok(!/\btd\b/.test(cls.Sport) && !/\bed\b/.test(cls.Sport), 'Sport (nur angepasst) hat keinen Punkt', cls.Sport);
  ok(await p.locator('.blk.ed').count() === 0, 'kein alter Änderungs-Punkt mehr');
  const dot = await p.evaluate(([tue]) => { const b = [...document.querySelectorAll('.blk.td')].find(x => x.dataset.d === tue); return getComputedStyle(b, '::after').content; }, [tue]);
  ok(dot === '""', 'Punkt wird gezeichnet', dot);
  ok((await txt('.gf')).includes('To-Dos'), 'Hinweis erklärt den Punkt');
  // Lernen am Dienstag: alle To-Dos abgehakt, trotzdem volle Farbe
  const lern = await p.evaluate(([tue]) => { const b = [...document.querySelectorAll('.blk')].find(x => x.dataset.d === tue && x.dataset.id === 'l1'); return { cls: b.className, op: getComputedStyle(b).opacity, f: getComputedStyle(b).filter }; }, [tue]);
  ok(!/\bdone\b/.test(lern.cls) && lern.op === '1' && lern.f === 'none', 'abgehakter Blocker verblasst nicht', JSON.stringify(lern));

  /* ---------- 7: Tagesbeginn und -ende ---------- */
  await tap('#tabs [data-t="set"]', 400);
  ok((await txt('#page')).includes('Tag beginnt um') && (await txt('#page')).includes('Tag endet um'), 'Einstellungen vorhanden');
  await tap('[data-a="opt"][data-o="dayS"]', 400);
  await tap('.layer.pl button:has-text("05:00")', 500);
  await tap('[data-a="opt"][data-o="dayE"]', 400);
  await tap('.layer.pl button:has-text("Mitternacht")', 500);
  d = await D(); ok(d.set.dayS === 5 && d.set.dayE === 24, 'gespeichert', d.set.dayS + '-' + d.set.dayE);
  ok((await txt('#page')).includes('05:00') && (await txt('#page')).includes('Mitternacht'), 'Werte angezeigt');
  await tap('#tabs [data-t="week"]', 500);
  ok(await p.evaluate(() => WK.H0 === 5 && WK.H1 === 24), 'Woche reicht von 5 bis 24 Uhr', await p.evaluate(() => WK.H0 + '-' + WK.H1));
  await tap('#tabs [data-t="set"]', 400);
  await tap('[data-a="opt"][data-o="dayS"]', 400); await tap('.layer.pl button:has-text("10:00")', 500);
  await tap('[data-a="opt"][data-o="dayE"]', 400); await tap('.layer.pl button:has-text("20:00")', 500);
  await tap('#tabs [data-t="week"]', 500);
  ok(await p.evaluate(() => WK.H0 === 8 && WK.H1 === 21), 'Blocker außerhalb bleiben sichtbar (8 bis 20:30)', await p.evaluate(() => WK.H0 + '-' + WK.H1));
  // Grenze im Bearbeiten: Lernen (19–20:30) lässt sich nicht über 20:30 hinaus verlängern, wenn der Tag um 20 Uhr endet
  const lim = await p.evaluate(([k]) => { const l = dayList(k), x = l.find(y => y.id === 'l1'); return { lim: dayLim(l), r: fitResize(l.filter(y => y.id !== 'l1'), x, x.s, x.e + 120, dayLim(l)) }; }, [wed]);
  ok(lim.lim[0] === 8 * 60 && lim.lim[1] === 20 * 60 + 30 && lim.r[1] === 20 * 60 + 30, 'Bearbeiten bleibt im Tag', JSON.stringify(lim));
  await tap('#tabs [data-t="set"]', 400);
  await tap('[data-a="go"][data-p="master"]', 600);
  ok((await txt('.mweek .mf')).includes('08:00'), 'Master-Übersicht nutzt den Bereich', await txt('.mweek .mf'));
  await tap('[data-a="back"]', 400);
  await tap('[data-a="opt"][data-o="dayS"]', 400); await tap('.layer.pl button:has-text("07:00")', 500);
  await tap('[data-a="opt"][data-o="dayE"]', 400); await tap('.layer.pl button:has-text("23:00")', 500);

  /* ---------- 8: Neuer Tag räumt Haken auf ---------- */
  await setNow(3, 9, 0); await W(200);
  await p.evaluate(() => { ui.lastToday = addD(today(), -1); tick(); }); await W(400);
  d = await D(); ok(!d.chk[tue], 'Haken von gestern sind am nächsten Tag weg', JSON.stringify(d.chk));
  ok(d.stat.n === 6 && d.stat.d[tue] >= 1, 'gezählt bleibt gezählt');

  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  console.log(`pass ${pass} fail ${fail}`);
  await b.close();
})();
