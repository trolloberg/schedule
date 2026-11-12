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
  async function drag(x0, y0, x1, y1, hold = 0, steps = 12){
    await touch('touchStart', x0, y0); await W(hold || 30);
    for (let i = 1; i <= steps; i++){ await touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await W(16); }
    await W(60); await touch('touchEnd'); await W(400);
  }
  async function press(x, y, hold){ await touch('touchStart', x, y); await W(hold); await touch('touchEnd'); await W(400); }
  const D = () => p.evaluate(() => JSON.parse(JSON.stringify(D)));
  const hdlB = () => p.evaluate(() => { const r = document.querySelector('.blk.sel .hdl.bot').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 9 }; });
  await p.addInitScript(() => { if (!localStorage.getItem('sp.data.v1')) localStorage.setItem('sp.data.v1', JSON.stringify({ v: 3, slots: [], ov: {}, chk: {}, todos: [], set: { tut: 3 } })); });
  await p.goto(URL); await W(500);
  await p.evaluate(() => loadSample()); await W(300);
  await p.click('#tabs [data-t="week"]'); await W(500);
  const wk = await p.evaluate(() => WK.days);
  const mon = wk[0], tue = wk[1], wed = wk[2];
  const sid = t => p.evaluate(t => D.slots.find(s => s.title === t).id, t);
  const rect = (k, id) => p.evaluate(([k, id]) => { const e = blockEl(k, id); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, h: r.height }; }, [k, id]);
  const occT = (k, id) => p.evaluate(([k, id]) => { const o = findOcc(k, id); return o ? (o.skipped ? 'skip' : o.start + '-' + o.end) : null; }, [k, id]);
  const heim = await sid('Heimweg'), sport = await sid('Sport'), essen = await sid('Abendessen'), side = await sid('Side-Hustle'), arbeit = await sid('Arbeit'), abend = await sid('Abendroutine');
  // scroll so Monday 16:00 is visible
  await p.evaluate(() => { scroller.scrollTop = (16 * 60 - WK.H0 * 60) * PPM - 250; });
  await W(200);
  let r = await rect(mon, heim);
  ok(r && r.y > 100 && r.y < 700, 'heimweg visible', JSON.stringify(r));
  // 1) long press enters edit mode with selection
  await press(r.x, r.y, 700);
  ok(await p.evaluate(() => ED.on), 'edit mode on after long press');
  ok(await p.evaluate(() => ED.sel && ED.sel.id), 'block selected');
  ok(await p.locator('.wk.editing .blk.sel .hdl.bot').count() === 1, 'handles shown');
  ok(await p.locator('.layer').count() === 0, 'no sheet opened by long press');
  await p.screenshot({ path: '/tmp/claude-0/shots33/e1-edit.png' });
  // 2) extend Heimweg bottom by 60 min -> the following blocks are pushed, gaps absorb, nothing is cut
  let hb = await hdlB();
  await drag(hb.x, hb.y, hb.x, hb.y + 60);
  ok(await occT(mon, heim) === '16:00-17:30', 'heimweg extended to 17:30', await occT(mon, heim));
  ok(await occT(mon, sport) === '17:30-19:00', 'sport pushed, same length', await occT(mon, sport));
  ok(await occT(mon, essen) === '19:00-19:45', 'abendessen pushed (gap absorbed 15)', await occT(mon, essen));
  ok(await occT(mon, side) === '19:45-21:15', 'side hustle pushed', await occT(mon, side));
  ok(await occT(mon, abend) === '22:00-22:30', 'abendroutine untouched (gap absorbs)', await occT(mon, abend));
  ok(await p.locator('.layer.al').count() === 0, 'no prompt');
  await p.screenshot({ path: '/tmp/claude-0/shots33/e2-extend.png' });
  // 3) extend again by 60 with live preview: neighbours move while dragging
  hb = await hdlB();
  await touch('touchStart', hb.x, hb.y); await W(30);
  for (let i = 1; i <= 12; i++){ await touch('touchMove', hb.x, hb.y + 60 * i / 12); await W(16); }
  await W(100);
  const prevTop = await p.evaluate(([k, id]) => parseFloat(blockEl(k, id).style.top), [mon, sport]);
  ok(Math.abs(prevTop - await p.evaluate(() => WK.Y(18 * 60 + 30))) < 2, 'preview: sport already at 18:30', prevTop);
  ok(await p.locator('.blk.covered').count() === 0, 'preview: nothing covered');
  await p.screenshot({ path: '/tmp/claude-0/shots33/e3-preview.png' });
  await touch('touchEnd'); await W(500);
  ok(await p.locator('.layer.al').count() === 0, 'no prompt when pushing a whole chain');
  ok(await occT(mon, heim) === '16:00-18:30', 'heimweg to 18:30', await occT(mon, heim));
  ok(await occT(mon, sport) === '18:30-20:00', 'sport shifted after heimweg', await occT(mon, sport));
  ok(await occT(mon, essen) === '20:00-20:45', 'abendessen shifted', await occT(mon, essen));
  ok(await occT(mon, side) === '20:45-22:15', 'side shifted', await occT(mon, side));
  ok(await occT(mon, abend) === '22:15-22:45', 'abendroutine shifted', await occT(mon, abend));
  ok(await occT(tue, heim) === '16:00-16:30', 'tuesday untouched', await occT(tue, heim));
  const d1 = await D();
  ok(d1.slots.find(s => s.id === heim).end === '16:30', 'master untouched');
  ok(await p.locator('#toast [data-a="_undo"]').count() === 0, 'no toast undo in edit mode');
  await p.click('[data-a="edUndo"]'); await W(400);
  ok(await occT(mon, heim) === '16:00-17:30', 'undo restored', await occT(mon, heim));
  ok(await occT(mon, sport) === '17:30-19:00', 'undo restored sport', await occT(mon, sport));
  await p.click('[data-a="edRedo"]'); await W(400);
  ok(await occT(mon, heim) === '16:00-18:30', 'redo again', await occT(mon, heim));
  await p.click('[data-a="edUndo"]'); await W(400);
  ok(await occT(mon, heim) === '16:00-17:30', 'undo once more', await occT(mon, heim));
  // 3b) shorten Heimweg back by 60 -> the touching chain follows, no whitespace; the gap before Abendroutine stays
  hb = await hdlB();
  await drag(hb.x, hb.y, hb.x, hb.y - 60);
  ok(await occT(mon, heim) === '16:00-16:30', 'heimweg shortened', await occT(mon, heim));
  ok(await occT(mon, sport) === '16:30-18:00', 'sport pulled up', await occT(mon, sport));
  ok(await occT(mon, essen) === '18:00-18:45', 'abendessen pulled up', await occT(mon, essen));
  ok(await occT(mon, side) === '18:45-20:15', 'side pulled up', await occT(mon, side));
  ok(await occT(mon, abend) === '22:00-22:30', 'abendroutine not part of the chain', await occT(mon, abend));
  // 3c) top edge: extend Sport upwards by 30 -> Heimweg is pushed earlier, Arbeit too (touching), no overlap
  await p.evaluate(([k, id]) => { ED.sel = { k, id }; render(); }, [mon, sport]); await W(200);
  const ht = await p.evaluate(() => { const r = document.querySelector('.blk.sel .hdl.top').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await drag(ht.x, ht.y, ht.x, ht.y - 30);
  ok(await occT(mon, sport) === '16:00-18:00', 'sport starts 16:00', await occT(mon, sport));
  ok(await occT(mon, heim) === '15:30-16:00', 'heimweg pushed earlier', await occT(mon, heim));
  ok(await occT(mon, arbeit) === '07:00-15:30', 'arbeit pushed earlier (touching)', await occT(mon, arbeit));
  ok(await occT(mon, await sid('Morgenroutine')) === '06:30-07:00', 'morning routine: gap absorbed', await occT(mon, await sid('Morgenroutine')));
  await p.click('[data-a="edUndo"]'); await W(400);
  ok(await occT(mon, sport) === '16:30-18:00', 'undo top edge', await occT(mon, sport));
  // 3d) extending is limited to the day: nothing gets pushed past the day end
  const cap = await p.evaluate(([k, id]) => { const l = dayList(k), x = l.find(y => y.id === id), o = l.filter(y => y.id !== id), lim = dayLim(l); const r = fitResize(o, x, x.s, x.e + 600, lim); const pl = resizePlan(o, x, r[0], r[1]); return { lim, ne: r[1], maxE: Math.max(...pl.map(y => y.e)) }; }, [mon, heim]);
  ok(cap.lim[1] === 23 * 60 && cap.maxE <= 23 * 60 && cap.ne > 16 * 60 + 30, 'capped at day end', JSON.stringify(cap));
  // 4) delete Sport (16:30-18:00) on Monday -> gap closes, the rest moves up
  await p.evaluate(([k, id]) => { ED.sel = { k, id }; render(); }, [mon, sport]); await W(200);
  await p.click(`.blk.sel .edel`); await W(500);
  ok(await occT(mon, sport) === 'skip', 'sport skipped on monday', await occT(mon, sport));
  ok(await occT(mon, essen) === '16:30-17:15', 'abendessen moved up to close gap', await occT(mon, essen));
  ok(await occT(mon, side) === '17:15-18:45', 'side hustle moved up too', await occT(mon, side));
  ok(await occT(mon, abend) === '20:30-21:00', 'abendroutine moved up too', await occT(mon, abend));
  // 5) move Side-Hustle on Monday to Tuesday 19:30 -> Lernen and the rest make room (no prompt, nothing trimmed)
  await p.evaluate(([k, id]) => { ED.sel = { k, id }; render(); }, [mon, side]); await W(200);
  r = await rect(mon, side);
  const tr = await p.evaluate(k => { const c = [...document.querySelectorAll('.wk-c')].find(c => c.dataset.d === k).getBoundingClientRect(); return c.left + c.width / 2; }, tue);
  const lern = await sid('Lernen');
  const rl = await rect(tue, lern);
  await drag(r.x, r.y, tr, rl.top + (r.y - r.top));
  ok(await p.locator('.layer.al').count() === 0, 'no prompt when dropping onto Lernen');
  ok(await occT(tue, lern) === '21:00-22:30', 'lernen pushed later, same length', await occT(tue, lern));
  ok(await occT(tue, abend) === '22:30-23:00', 'abendroutine pushed after lernen', await occT(tue, abend));
  ok(await occT(tue, essen) === '18:45-19:30', 'abendessen untouched', await occT(tue, essen));
  ok(await occT(mon, side) === 'skip', 'side hustle gone from monday', await occT(mon, side));
  ok(await p.evaluate(([k, id]) => !blockEl(k, id) && !document.querySelector('.blk.skip'), [mon, side]), 'no leftover of side hustle on monday');
  const tueList = await p.evaluate(k => occ(k).filter(o => !o.skipped).map(o => o.title + ' ' + o.start + '-' + o.end + (o.extra ? '*' : '')), tue);
  ok(tueList.includes('Side-Hustle 19:30-21:00*'), 'side hustle on tuesday as extra', tueList.join(' | '));
  // 6) duplicate Sport from Wednesday to Tuesday 17:00 via menu
  await p.evaluate(([k, id]) => { ED.sel = { k, id }; render(); }, [wed, sport]); await W(200);
  r = await rect(wed, sport);
  await press(r.x, r.y, 750);
  ok(await p.locator('.layer.pl').count() === 1, 'context menu after long press in edit mode');
  await p.screenshot({ path: '/tmp/claude-0/shots33/e5-menu.png' });
  await p.click('.layer.pl button:has-text("Duplizieren")'); await W(500);
  ok(await p.locator('.ghost.pend').count() === 1, 'pending ghost shown');
  await p.screenshot({ path: '/tmp/claude-0/shots33/e6-dup.png' });
  const g = await p.evaluate(() => { const r = document.querySelector('.ghost.pend').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 10 }; });
  await drag(g.x, g.y, tr, g.y - 6);
  const tl2 = await p.evaluate(k => occ(k).filter(o => !o.skipped).map(o => o.title + ' ' + o.start + '-' + o.end + (o.extra ? '*' : '')), tue);
  ok(tl2.includes('Sport 17:00-18:30*'), 'sport duplicated to tuesday', tl2.join(' | '));
  ok(await occT(wed, sport) === '17:00-18:30', 'wednesday sport still there');
  // 7) split Arbeit on Tuesday at 12:00
  const ra = await rect(tue, arbeit);
  await p.evaluate(([k, id]) => { ED.sel = { k, id }; render(); }, [tue, arbeit]); await W(200);
  await p.evaluate(([k, id]) => startCut(k, id), [tue, arbeit]); await W(300);
  ok(await p.locator('.cutl').count() === 1, 'cut line shown');
  const at0 = await p.evaluate(() => ED.cut.at);
  ok(at0 === 705 || at0 === 720 || at0 === 690, 'cut starts mid', at0);
  const cl = await p.evaluate(() => { const r = document.querySelector('.cutl').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await drag(cl.x, cl.y, cl.x, cl.y + (720 - at0) + 30);
  ok(await p.evaluate(() => ED.cut && ED.cut.at) === 750, 'cut moved to 12:30', await p.evaluate(() => ED.cut && ED.cut.at));
  await p.screenshot({ path: '/tmp/claude-0/shots33/e7-cut.png' });
  await p.click('[data-a="edCutGo"]'); await W(500);
  const tl3 = await p.evaluate(k => occ(k).filter(o => !o.skipped && o.title === 'Arbeit').map(o => o.start + '-' + o.end), tue);
  ok(tl3.join(',') === '07:30-12:30,12:30-16:00', 'arbeit split', tl3.join(','));
  // 8) normal mode tap opens detail with repeat info
  await p.click('[data-a="edDone"]'); await W(500);
  ok(!(await p.evaluate(() => ED.on)), 'edit mode off');
  r = await rect(wed, sport);
  await p.touchscreen.tap(r.x, r.y); await W(600);
  const det = await p.locator('.sheet.float').innerText().catch(() => '');
  ok(/Mo, Mi, Fr/.test(det) && /Nächstes Mal/.test(det), 'detail shows repeat + next', det);
  await p.screenshot({ path: '/tmp/claude-0/shots33/e8-detail.png' });
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  console.log(`pass ${pass} fail ${fail}`);
  await b.close();
})();
