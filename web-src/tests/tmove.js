// Tests für 3.1: Ausweichen beim Verschieben, Hineinlegen nach langem Halten, Rückgängig/Wiederholen, keine Reste
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
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  async function glide(x0, y0, x1, y1, steps = 10){ for (let i = 1; i <= steps; i++){ await touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await W(16); } }
  await p.addInitScript(() => { if (!localStorage.getItem('sp.data.v1')) localStorage.setItem('sp.data.v1', JSON.stringify({ v: 3, slots: [], ov: {}, chk: {}, todos: [], set: { tut: 3 } })); });
  await p.goto(URL); await W(500);
  await p.evaluate(() => loadSample()); await W(300);
  await p.click('#tabs [data-t="week"]'); await W(500);
  const wk = await p.evaluate(() => WK.days);
  const [mon, tue, wed, thu] = wk;
  const sid = t => p.evaluate(t => D.slots.find(s => s.title === t).id, t);
  const occT = (k, id) => p.evaluate(([k, id]) => { const o = findOcc(k, id); return o ? (o.skipped ? 'skip' : o.start + '-' + o.end) : null; }, [k, id]);
  const rect = (k, id) => p.evaluate(([k, id]) => { const e = blockEl(k, id); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, h: r.height }; }, [k, id]);
  const colX = k => p.evaluate(k => { const c = [...document.querySelectorAll('.wk-c')].find(c => c.dataset.d === k).getBoundingClientRect(); return c.left + c.width / 2; }, k);
  const yOf = m => p.evaluate(m => $('.wk-b', page).getBoundingClientRect().top + WK.Y(m), m);
  const topOf = (k, id) => p.evaluate(([k, id]) => { const e = blockEl(k, id); return e ? parseFloat(e.style.top) : null; }, [k, id]);
  const Yv = m => p.evaluate(m => WK.Y(m), m);
  const show = m => p.evaluate(m => { scroller.scrollTop = 0; const y = $('.wk-b', page).getBoundingClientRect().top + WK.Y(m); scroller.scrollTop = y - 420; onScroll(); }, m);
  const sel = (k, id) => p.evaluate(([k, id]) => { ED.sel = { k, id }; render(); }, [k, id]);
  const snapN = () => p.evaluate(() => JSON.stringify(migrate(JSON.parse(JSON.stringify(D)))));
  const dis = a => p.evaluate(a => { const e = document.querySelector(`[data-a="${a}"]`); return e ? e.disabled : null; }, a);
  const heim = await sid('Heimweg'), sport = await sid('Sport'), essen = await sid('Abendessen'), side = await sid('Side-Hustle'), abend = await sid('Abendroutine'), arbeit = await sid('Arbeit'), morgen = await sid('Morgenroutine');

  // --- Regel als reine Funktion ---
  const pa = await p.evaluate(() => {
    const L0 = [{ id: 'a', s: 600, e: 660 }, { id: 'b', s: 660, e: 720 }, { id: 'c', s: 750, e: 780 }, { id: 'o1', s: 900, e: 960 }, { id: 'o2', s: 920, e: 940 }];
    const r1 = pushAside(L0, 630, 690), m1 = Object.fromEntries(r1.list.map(x => [x.id, x.s + '-' + x.e]));
    const r2 = pushAside(L0, 880, 910), m2 = Object.fromEntries(r2.list.map(x => [x.id, x.s + '-' + x.e]));
    const r3 = pushAside([{ id: 'z', s: 1380, e: 1430 }], 1350, 1410);
    return { m1, n1: r1.moved.length, m2, lost: r3.list.filter(x => x.e > DAY_END).map(x => x.id) };
  });
  // a (Mitte 630) liegt vor der Mitte 660 -> nach oben bis 630; b (Mitte 690) -> nach unten ab 690; c rückt hinter b
  ok(pa.m1.a === '570-630' && pa.m1.b === '690-750' && pa.m1.c === '750-780', 'pushAside up/down + gap absorbs', JSON.stringify(pa.m1));
  ok(pa.n1 === 2, 'two moved', pa.n1);
  // überlappende o1/o2 bleiben überlappend, nur o1 muss weg
  ok(pa.m2.o1 === '910-970' && pa.m2.o2 === '920-940', 'old overlaps may stay', JSON.stringify(pa.m2));
  ok(pa.lost.join() === 'z', 'pushed past midnight is lost', pa.lost.join());

  // --- Bearbeiten an, Knöpfe ---
  await p.click('[data-a="edStart"]'); await W(400);
  ok(await p.evaluate(() => ED.on), 'edit on');
  ok(await dis('edUndo') === true && await dis('edRedo') === true, 'undo/redo disabled at start');
  ok(await p.evaluate(() => document.getElementById('navT').textContent) === 'Bearbeiten', 'nav title');
  const navOk = await p.evaluate(() => { const l = $('#navL').getBoundingClientRect(), t = $('#navT').getBoundingClientRect(), r = $('#navR').getBoundingClientRect(); return l.right <= t.left + 1 && t.right <= r.left + 1 && r.right <= innerWidth; });
  ok(navOk, 'nav buttons do not overlap title');
  const D0 = await snapN();

  // 1) Heimweg (Mo) nach unten auf 17:00: Sport und alles danach weichen aus, keiner wird kürzer
  await show(17 * 60); await W(150);
  await sel(mon, heim);
  let r = await rect(mon, heim), cx = await colX(mon);
  let gx = r.x + 8, off = Math.round(r.h / 2);
  await touch('touchStart', gx, r.top + off); await W(40);
  let ty = await yOf(17 * 60) + off;
  await glide(gx, r.top + off, cx + 8, ty);
  await W(300);
  ok(await topOf(mon, sport) === await Yv(17 * 60 + 30), 'preview: sport moved aside to 17:30', await topOf(mon, sport));
  ok(await p.locator('.wk.drag').count() === 1 && await p.locator('.blk.moving').count() === 1, 'drag state');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.blk.moving')).opacity) === '0', 'original spot is empty while dragging');
  await p.screenshot({ path: '/tmp/claude-0/shots33/m1-push-preview.png' });
  await touch('touchEnd'); await W(500);
  ok(await p.locator('.layer.al').count() === 0, 'no prompt');
  ok(await occT(mon, heim) === '17:00-17:30', 'heimweg at 17:00', await occT(mon, heim));
  ok(await occT(mon, sport) === '17:30-19:00', 'sport pushed, still 90 min', await occT(mon, sport));
  ok(await occT(mon, essen) === '19:00-19:45', 'abendessen pushed', await occT(mon, essen));
  ok(await occT(mon, side) === '19:45-21:15', 'side hustle pushed', await occT(mon, side));
  ok(await occT(mon, abend) === '22:00-22:30', 'gap absorbs the push', await occT(mon, abend));
  ok(/weichen aus/.test(await p.locator('#toast').innerText()), 'toast names pushed blocks', await p.locator('#toast').innerText());
  ok(await dis('edUndo') === false && await dis('edRedo') === true, 'undo enabled after change');
  const D1 = await snapN();

  // 2) Abendroutine (Mo) nach oben auf 21:00: Side-Hustle liegt davor und weicht nach oben aus
  await show(21 * 60); await W(150);
  await sel(mon, abend);
  r = await rect(mon, abend);
  gx = r.x + 8; off = Math.round(r.h / 2);
  await touch('touchStart', gx, r.top + off); await W(40);
  ty = await yOf(21 * 60) + off;
  await glide(gx, r.top + off, gx, ty);
  await W(80); await touch('touchEnd'); await W(500);
  ok(await occT(mon, abend) === '21:00-21:30', 'abendroutine at 21:00', await occT(mon, abend));
  ok(await occT(mon, side) === '19:30-21:00', 'side hustle pushed earlier', await occT(mon, side));
  ok(await occT(mon, essen) === '18:45-19:30', 'abendessen pushed earlier too', await occT(mon, essen));
  const D2 = await snapN();

  // 3) Lange über Arbeit (Di) halten: Hineinlegen, im Blocker frei bewegen, dann teilen
  await show(13 * 60); await W(150);
  await sel(tue, heim);
  await show(13 * 60); await W(150);
  r = await rect(tue, heim);
  gx = r.x + 8; off = Math.round(r.h / 2);
  const startY = r.top + off;
  await touch('touchStart', gx, startY); await W(40);
  ty = await yOf(12 * 60) + off;
  await glide(gx, startY, gx, ty, 14);
  await W(200);
  ok(await p.locator('.blk.tgt').count() === 0, 'no insert before holding long');
  ok(await topOf(tue, arbeit) !== await Yv(7 * 60 + 30), 'arbeit moved aside first', await topOf(tue, arbeit));
  await W(900);
  ok(await p.locator('.blk.tgt').count() === 1, 'insert mode after hold');
  ok(await topOf(tue, arbeit) === await Yv(7 * 60 + 30), 'arbeit back in place under the block', await topOf(tue, arbeit));
  ok(await p.locator('.ghost.in').count() === 1, 'ghost shows inside');
  ok(/In Arbeit/.test(await p.locator('.tbub').innerText()), 'bubble names target', await p.locator('.tbub').innerText());
  await p.screenshot({ path: '/tmp/claude-0/shots33/m2-insert.png' });
  // innerhalb von Arbeit nach oben ziehen: bleibt in Arbeit (kein Ausweichen)
  ty = await yOf(10 * 60 + 3) + off;
  await glide(gx, await yOf(12 * 60) + off, gx, ty, 12);
  await W(100);
  ok(await p.locator('.blk.tgt').count() === 1, 'still inside while moving within');
  ok(await p.evaluate(() => G && G.s2) === 10 * 60, 'snapped inside arbeit', await p.evaluate(() => G && G.s2));
  ok(await topOf(tue, morgen) === await Yv(6 * 60 + 30), 'others stay while inside');
  // wieder auf 12:00 und loslassen
  await glide(gx, ty, gx, await yOf(12 * 60) + off, 12);
  await W(80); await touch('touchEnd'); await W(500);
  const tl = await p.evaluate(k => occ(k).filter(o => !o.skipped).map(o => o.title + ' ' + o.start + '-' + o.end), tue);
  ok(tl.includes('Arbeit 07:30-12:00') && tl.includes('Heimweg 12:00-12:30') && tl.includes('Arbeit 12:30-16:00'), 'arbeit split around heimweg', tl.join(' | '));
  ok(tl.includes('Morgenroutine 06:30-07:00'), 'others untouched', tl.join(' | '));
  ok(/in „Arbeit“/.test(await p.locator('#toast').innerText()), 'toast says inside', await p.locator('#toast').innerText());
  const D3 = await snapN();

  // 4) Hineinlegen endet, wenn man den Blocker verlässt (andere Spalte), zurück an den Start = keine Änderung
  await show(12 * 60); await W(150);
  await sel(wed, heim); await show(14 * 60); await W(150);
  r = await rect(wed, heim);
  gx = r.x + 8; off = Math.round(r.h / 2);
  await touch('touchStart', gx, r.top + off); await W(40);
  await glide(gx, r.top + off, gx, await yOf(11 * 60) + off, 14); await W(1100);
  ok(await p.locator('.blk.tgt').count() === 1, 'insert on wednesday');
  const tx = await colX(thu);
  await glide(gx, await yOf(11 * 60) + off, tx, await yOf(11 * 60) + off, 6); await W(150);
  ok(await p.locator('.blk.tgt').count() === 0, 'leaving the column ends insert');
  ok(await p.evaluate(() => !G.ins), 'insert state cleared');
  await glide(tx, await yOf(11 * 60) + off, gx, r.top + off, 14); await W(80);
  await touch('touchEnd'); await W(500);
  ok(await occT(wed, heim) === '16:00-16:30' && await occT(wed, arbeit) === '07:30-16:00', 'back home = nothing changed', await occT(wed, heim));
  ok(await snapN() === D3, 'data unchanged');

  // 5) Rückgängig über die ganze Sitzung und wieder vor
  await p.click('[data-a="edUndo"]'); await W(300);
  ok(await snapN() === D2, 'undo 1 -> state 2');
  ok(await dis('edRedo') === false, 'redo enabled');
  await p.click('[data-a="edUndo"]'); await W(300);
  ok(await snapN() === D1, 'undo 2 -> state 1');
  await p.click('[data-a="edUndo"]'); await W(300);
  ok(await snapN() === D0, 'undo 3 -> start');
  ok(await dis('edUndo') === true, 'undo disabled at start of session');
  ok(await p.evaluate(() => JSON.stringify(migrate(JSON.parse(localStorage.getItem('sp.data.v1'))))) === D0, 'undo is saved');
  for (let i = 0; i < 3; i++){ await p.click('[data-a="edRedo"]'); await W(300); }
  ok(await snapN() === D3, 'redo x3 -> state 3');
  ok(await dis('edRedo') === true, 'redo disabled at the end');
  await p.click('[data-a="edUndo"]'); await W(300);
  // neue Änderung nach Rückgängig löscht das Wiederholen
  await p.evaluate(([k, id]) => applyDelete(k, id), [thu, morgen]); await W(400);
  ok(await dis('edRedo') === true && await dis('edUndo') === false, 'new change clears redo');
  ok(await p.locator('#toast [data-a="_undo"]').count() === 0, 'toast without undo in edit mode');
  // Änderungen aus Blättern zählen auch (Details: ausfallen lassen)
  const nPast = await p.evaluate(() => HIST.past.length);
  const thuHeim = await occT(thu, heim);
  await p.evaluate(([k, id]) => withUndo('x', () => { ensureOs(k, id).skip = 1; }), [thu, heim]); await W(300);
  ok(await p.evaluate(() => HIST.past.length) === nPast + 1, 'other changes recorded too');
  ok(await p.evaluate(([k, id]) => !blockEl(k, id), [thu, heim]), 'skipped block not drawn in edit mode');
  await p.click('[data-a="edUndo"]'); await W(300);
  ok(await occT(thu, heim) === thuHeim, 'undo brings it back', await occT(thu, heim));
  ok(await p.evaluate(() => { const n = HIST.past.length; save(); return HIST.past.length === n; }), 'saving without change after undo adds no step');

  // 6) Fertig beendet die Sitzung, neuer Modus = neuer Verlauf
  await p.click('[data-a="edDone"]'); await W(400);
  ok(await p.evaluate(() => HIST.cur === null && !HIST.past.length && !HIST.next.length), 'history cleared on done');
  await p.click('[data-a="edStart"]'); await W(400);
  ok(await dis('edUndo') === true, 'fresh history on next session');
  await p.click('[data-a="edDone"]'); await W(400);

  // 7) Keine gestrichelten Reste: manuell ausfallen lassen (Details) -> Block verschwindet aus der Woche
  await show(17 * 60); await W(150);
  r = await rect(wed, sport);
  await p.touchscreen.tap(r.x, r.y); await W(600);
  await p.click('.layer [data-a="skip"]'); await W(700);
  ok(await occT(wed, sport) === 'skip', 'sport skipped on wednesday');
  ok(await p.evaluate(([k, id]) => !blockEl(k, id), [wed, sport]), 'no dashed remnant in week');
  ok(await p.locator('.blk.skip').count() === 0, 'no skip blocks at all');
  ok(!/Gestrichelt/.test(await p.locator('.gf').innerText()), 'hint no longer mentions dashed');
  ok(await p.locator('#toast [data-a="_undo"]').count() === 1, 'normal mode keeps toast undo');
  // Tagesansicht zeigt es weiter als ausgefallen (zum Wiedereinplanen)
  await p.screenshot({ path: '/tmp/claude-0/shots33/m3-noghost.png' });

  // 8) Rutscht ein Blocker über Mitternacht, wird vorher gefragt
  await p.evaluate(k => { const o = ensureOv(k); o.x.push({ id: 'xA', title: 'Spät A', desc: '', start: '22:00', end: '23:30', color: 'blue', icon: 'moon' }, { id: 'xB', title: 'Spät B', desc: '', start: '20:00', end: '21:00', color: 'red', icon: 'star' }); save(); edEnter(); render(); }, thu); await W(300);
  await p.evaluate(k => { placeMove(k, 'xB', k, 22 * 60 + 15, false); }, thu); await W(500);
  ok(await p.locator('.layer.al').count() === 1 && /passt nicht mehr/.test(await p.locator('.layer.al').innerText()), 'lost prompt', await p.locator('.layer.al').innerText().catch(() => ''));
  await p.click('.layer.al button:has-text("Abbrechen")'); await W(500);
  ok(await occT(thu, 'xB') === '20:00-21:00', 'cancel keeps it');
  await p.evaluate(k => { placeMove(k, 'xB', k, 22 * 60 + 15, false); }, thu); await W(500);
  await p.click('.layer.al button:has-text("Trotzdem")'); await W(500);
  ok(await occT(thu, 'xB') === '22:15-23:15' && await occT(thu, 'xA') === '23:15-23:30', 'move anyway, rest cut at day end (latest block)', await occT(thu, 'xA'));
  await p.click('[data-a="edDone"]'); await W(300);

  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  console.log(`pass ${pass} fail ${fail}`);
  await b.close();
})();
