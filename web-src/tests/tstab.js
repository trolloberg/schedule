// Stabilitätstests für Schedule 3.0.1: sanfte Updates, Selbstheilung, hängende Gesten, Fehler-Fallback, Belastungstest
const { chromium } = require('playwright');
const URL = 'http://localhost:8099/stundenplan/';
const N = +(process.env.N || 400), SEED = +(process.env.SEED || 7);
let pass = 0, fail = 0;
const ok = (c, n, extra = '') => { if (c) pass++; else { fail++; console.log('FAIL:', n, String(extra).slice(0, 400)); } };
(async () => {
  const b = await chromium.launch({ channel: 'chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const cdp = await ctx.newCDPSession(p);
  const W = ms => p.waitForTimeout(ms);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  async function drag(x0, y0, x1, y1, hold = 30, steps = 10){
    await touch('touchStart', x0, y0); await W(hold);
    for (let i = 1; i <= steps; i++){ await touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await W(16); }
    await W(40); await touch('touchEnd'); await W(350);
  }
  // Uhr der Seite verstellbar machen (Timer laufen normal weiter)
  await p.addInitScript(() => {
    window.__off = 0; const RD = Date;
    class FD extends RD { constructor(...a){ if (a.length) super(...a); else super(RD.now() + window.__off); } static now(){ return RD.now() + window.__off; } }
    window.Date = FD;
    if (!localStorage.getItem('sp.data.v1')) localStorage.setItem('sp.data.v1', JSON.stringify({ v: 3, slots: [], ov: {}, chk: {}, todos: [], set: { tut: 3 } }));
  });
  await p.goto(URL); await W(500);
  await p.evaluate(() => loadSample()); await W(400);
  // Tageszeit auf 15:20 stellen, damit „Jetzt“-Karte und Jetzt-Linie sichtbar sind
  await p.evaluate(() => { const d = new Date(); window.__off += ((15 * 60 + 20) - (d.getHours() * 60 + d.getMinutes())) * 60000; OCC.clear(); render(); });
  const quiet = () => W(1300);   // busy() endet 1,2 s nach dem letzten Scrollen

  /* ---------- 1: sanftes Update statt Neuaufbau ---------- */
  for (const tab of ['day', 'week']){
    await p.click(`#tabs [data-t="${tab}"]`); await W(400); await quiet();
    const r = await p.evaluate(() => {
      const els = [...page.querySelectorAll('*')]; els.forEach((e, i) => { e.__k = i + 1; });
      const before = page.innerHTML;
      window.__off += 7 * 60000; tick();
      const after = page.innerHTML, kept = [...page.querySelectorAll('*')].filter(e => e.__k).length, total = page.querySelectorAll('*').length;
      render(); const fresh = page.innerHTML;
      return { changed: before !== after, same: after === fresh, kept, total };
    });
    ok(r.changed, `${tab}: Uhrzeit-Update ändert die Anzeige`);
    ok(r.same, `${tab}: sanftes Update = vollständiger Neuaufbau`);
    ok(r.kept / r.total > 0.9, `${tab}: Elemente bleiben erhalten`, JSON.stringify(r));
  }

  /* ---------- 2: während des Scrollens nichts austauschen ---------- */
  await p.click('#tabs [data-t="week"]'); await W(300); await quiet();   // lange Seite, damit wirklich gescrollt wird
  await p.evaluate(() => { scroller.scrollTop = 0; }); await quiet();
  const d1 = await p.evaluate(() => { window.__off += 9 * 60000; return page.innerHTML; });   // Uhr vorstellen, noch ohne Takt
  await drag(200, 600, 200, 420, 10, 5);   // echter Wisch nach oben
  const d2 = await p.evaluate(() => { tick(); return page.innerHTML; });
  ok(d1 === d2, 'kein Update direkt nach dem Scrollen', await p.evaluate(() => JSON.stringify({ busy: busy(), sa: Date.now() - lastScrollAt, ta: Date.now() - touchAt })));
  await W(2600);
  ok(await p.evaluate(h => page.innerHTML !== h, d2), 'Update kommt kurz danach nach');

  /* ---------- 3: Ansicht mit Fehler zeigt Hinweis, Protokoll ---------- */
  await p.evaluate(() => { window.__todo = VIEWS.prod; VIEWS.prod = () => { throw new Error('Testfehler'); }; });
  await p.click('#tabs [data-t="prod"]'); await W(400);
  ok(await p.locator('#page [data-a="reload"]').count() === 1, 'Fehler-Ansicht mit „Neu laden“');
  ok(await p.evaluate(() => errLog().length === 1 && errLog()[0].m === 'Testfehler'), 'Fehler im Protokoll');
  await p.evaluate(() => { VIEWS.prod = window.__todo; });
  await p.click('#tabs [data-t="day"]'); await W(300); await p.click('#tabs [data-t="prod"]'); await W(300);
  ok(await p.locator('#page [data-a="reload"]').count() === 0, 'To-Dos wieder normal');
  await p.click('#tabs [data-t="set"]'); await W(300);
  await p.click('#page [data-p="about"]'); await W(500);
  ok(/Fehlerprotokoll/i.test(await p.locator('#page').innerText()), 'Protokoll unter Über sichtbar');
  await p.click('#page [data-a="logClear"]'); await W(400);
  ok(!/Fehlerprotokoll/i.test(await p.locator('#page').innerText()) && await p.evaluate(() => errLog().length === 0), 'Protokoll leeren');
  // Fehler in einer Aktion: Oberfläche bleibt bedienbar
  await p.evaluate(() => { A.__boom = () => { page.innerHTML = ''; throw new Error('Aktion kaputt'); }; const bt = document.createElement('button'); bt.dataset.a = '__boom'; bt.id = 'boom'; bt.textContent = 'Boom'; page.appendChild(bt); });
  await p.click('#boom'); await W(300);
  ok(await p.evaluate(() => !!page.firstElementChild && errLog().length === 1), 'kaputte Aktion: Seite wird neu aufgebaut', await p.evaluate(() => JSON.stringify(errLog())));
  await p.evaluate(() => localStorage.removeItem('sp.log'));
  await p.click('#tabs [data-t="set"]'); await W(400);

  /* ---------- 4: Seitenwechsel ohne Unsichtbar-Start ---------- */
  await p.click('#tabs [data-t="week"]'); await W(400);
  const op = await p.evaluate(() => { const w = ui.week; A.weekNext(); return { o: getComputedStyle(page).opacity, w, now: ui.week }; });
  ok(op.o === '1', 'Wochenwechsel startet sichtbar', JSON.stringify(op));
  await W(700);
  ok(await p.evaluate(w => ui.week === addD(w, 7) && !page.style.transform && !page.style.opacity && !page.classList.contains('wsw') && !$('#veil').classList.contains('on') && getComputedStyle(page).opacity === '1', op.w), 'Wochenwechsel räumt vollständig auf');
  await p.evaluate(() => A.weekNow()); await W(400);

  /* ---------- 5: Geste beim Wechsel in den Hintergrund ---------- */
  const hide = h => p.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  const blk = () => p.evaluate(() => { for (const e of page.querySelectorAll('.blk:not(.skip)')){ const r = e.getBoundingClientRect(); if (r.top > 220 && r.bottom < 700 && r.height > 30) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } return null; });
  await p.evaluate(() => { scroller.scrollTop = (16 * 60 - WK.H0 * 60) * PPM - 250; }); await W(300);
  let bp = await blk();
  ok(!!bp, 'Block für Gestentest gefunden');
  await touch('touchStart', bp.x, bp.y); await W(700);
  ok(await p.evaluate(() => !!G && ED.on), 'gedrückt halten: Geste läuft');
  await hide(true); await W(100);
  ok(await p.evaluate(() => G === null && lockY === null), 'Hintergrund: Geste wird abgebrochen');
  await touch('touchEnd'); await W(200);
  await hide(false); await W(600);
  ok(await p.evaluate(() => !!page.firstElementChild && G === null), 'nach Rückkehr: Seite da, keine Geste');
  await p.evaluate(() => A.edDone()); await W(400);

  /* ---------- 6: verlorenes Ende einer Geste ---------- */
  await W(300); bp = await blk();
  await touch('touchStart', bp.x, bp.y); await W(700);
  ok(await p.evaluate(() => G && G.kind === 'ready'), 'Geste bereit');
  await p.evaluate(() => document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [] })));
  await W(250);
  ok(await p.evaluate(() => G === null), 'touchend ohne pointerup beendet die Geste');
  await touch('touchEnd'); await W(300);
  // Alte Geste ohne jedes Ende: Wächter im Takt löst sie
  await p.evaluate(() => { G = { pid: 4242, pt: 'touch', kind: 'ready', t: Date.now() - 60000, k: WK.days[0], id: 'x' }; lockScroll(true); });
  await quiet();
  await p.evaluate(() => tick()); await W(300);
  ok(await p.evaluate(() => G === null && lockY === null), 'hängende Geste wird vom Takt gelöst');
  // Neuer Finger mit anderer Kennung beendet eine alte Geste
  await p.evaluate(() => { G = { pid: 4343, pt: 'touch', kind: 'press', t: Date.now(), timer: 0 }; });
  bp = await blk();
  await touch('touchStart', bp.x, bp.y); await W(80); await touch('touchEnd'); await W(400);
  ok(await p.evaluate(() => G === null), 'neuer Finger räumt alte Geste ab');
  await p.evaluate(() => { if (ED.on) A.edDone(); for (const s of stack.slice()) s.close(); }); await W(600);
  ok(await p.evaluate(() => scroller.style.overflowY === ''), 'Scroll-Bereich nie per overflow gesperrt');

  /* ---------- 7: Heilung nach Rückkehr und nach Überlagerungen ---------- */
  await settle(); await W(300);
  await p.evaluate(() => { window.__heal = 0; const h = heal; window.heal = () => { window.__heal++; h(); }; });
  const y0 = await p.evaluate(() => scroller.scrollTop);
  await hide(true); await W(50); await hide(false); await W(600);
  ok(await p.evaluate(() => window.__heal >= 1), 'Rückkehr: Seite wird neu aufgebaut', await p.evaluate(() => JSON.stringify({ busy: busy(), touches, ta: Date.now() - touchAt, sa: Date.now() - lastScrollAt, G: !!G, hidden: document.hidden, layers: [...document.querySelectorAll('.layer')].map(l => l.className + ':' + (l.textContent || '').slice(0, 40)), ed: ED.on })));
  ok(Math.abs(await p.evaluate(() => scroller.scrollTop) - y0) <= 1, 'Rückkehr: Scroll-Position bleibt');
  await p.evaluate(() => { window.__heal = 0; }); bp = await blk();
  await p.mouse.click(bp.x, bp.y); await W(700);
  ok(await p.locator('.layer').count() === 1, 'Detail offen', await p.evaluate(() => JSON.stringify({ layers: document.querySelectorAll('.layer').length, ed: ED.on, tab: ui.tab, G: !!G, swallow })) + JSON.stringify(bp));
  await p.keyboard.press('Escape'); await W(800);
  ok(await p.evaluate(() => window.__heal >= 1 && !document.querySelector('.layer')), 'nach dem Schließen: Seite wird neu aufgebaut');
  // Aktiven Tab antippen
  await p.evaluate(() => { window.__heal = 0; }); await p.click('#tabs [data-t="week"]'); await W(700);
  ok(await p.evaluate(() => window.__heal === 1), 'aktiven Tab antippen heilt die Ansicht');

  /* ---------- 8: Belastungstest mit zufälligen Aktionen ---------- */
  let seed = SEED; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = a => a[Math.floor(rnd() * a.length)];
  async function settle(){
    for (let i = 0; i < 8; i++){
      const s = await p.evaluate(() => ({ al: !!document.querySelector('.layer.al.in'), pl: !!document.querySelector('.layer.pl.in'), as: !!document.querySelector('.layer.as.in'), sh: stack.length, tut: !!document.querySelector('.tut') }));
      if (s.al){ await p.locator('.layer.al.in button').last().click(); await W(350); continue; }
      if (s.pl){ await p.mouse.click(6, 420); await W(350); continue; }
      if (s.as){ await p.locator('.layer.as.in .asc').click(); await W(450); continue; }
      if (s.sh){ await p.keyboard.press('Escape'); await W(550); continue; }
      if (s.tut){ await p.locator('.tut [data-a="done"]').first().click(); await W(450); continue; }
      break;
    }
  }
  const check = async (step, act) => {
    await p.waitForFunction(() => !WT, null, { timeout: 2500 }).catch(() => {});   // laufender Wochenwechsel darf zu Ende spielen
    const s = await p.evaluate(() => {
      const r = page.getBoundingClientRect(), cs = getComputedStyle(page), max = scroller.scrollHeight - scroller.clientHeight;
      return { kids: page.childElementCount, op: cs.opacity, disp: cs.display, ov: scroller.style.overflowY, inView: r.bottom > 120 && r.top < innerHeight - 150, st: scroller.scrollTop, max, g: !!G, lock: lockY, layers: document.querySelectorAll('.layer').length, log: errLog().length };
    });
    const bad = [];
    if (!s.kids) bad.push('leer'); if (s.op !== '1') bad.push('opacity ' + s.op); if (s.disp === 'none') bad.push('display none');
    if (s.ov) bad.push('overflow ' + s.ov); if (!s.inView) bad.push('Inhalt außerhalb'); if (s.st > s.max + 1) bad.push('scroll ' + s.st + '>' + s.max);
    if (s.g) bad.push('Geste hängt'); if (s.lock !== null) bad.push('Scroll gesperrt'); if (s.layers) bad.push('Ebene übrig'); if (s.log) bad.push('Fehlerprotokoll');
    ok(!bad.length, `Belastung Schritt ${step} (${act})`, bad.join(', ') + ' ' + JSON.stringify(s));
    return !bad.length;
  };
  const acts = {
    tab: async () => { await p.click(`#tabs [data-t="${pick(['day', 'week', 'prod', 'set'])}"]`); await W(350); },
    weekNav: async () => { await p.click('#tabs [data-t="week"]'); await W(300); await p.evaluate(a => { if (!ED.on) A[a](); }, pick(['weekPrev', 'weekNext', 'weekNow'])); await W(400); },
    swipe: async () => { await p.click('#tabs [data-t="week"]'); await W(300); const dx = pick([-170, 170]); await drag(195 - dx / 2, 520, 195 + dx / 2, 525, 20, 6); },
    scroll: async () => { await p.evaluate(v => { scroller.scrollTop = v * (scroller.scrollHeight - scroller.clientHeight); }, rnd()); await W(250); await p.mouse.wheel(0, pick([-400, -120, 120, 400])); await W(300); },
    flick: async () => { const y = 300 + rnd() * 300; await drag(200, y, 205, y + pick([-260, 260]), 10, 4); await W(250); },
    detail: async () => { const sel = await p.evaluate(() => ui.tab === 'week' ? '.blk:not(.skip)' : ui.tab === 'day' ? '.tlr' : null); if (!sel) return; const pt = await p.evaluate(s => { for (const e of page.querySelectorAll(s)){ const r = e.getBoundingClientRect(); if (r.top > 150 && r.bottom < 700) return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 30) }; } return null; }, sel); if (!pt) return; await p.mouse.click(pt.x, pt.y); await W(600); },
    edit: async () => {
      await p.click('#tabs [data-t="week"]'); await W(300);
      const pt = await blk(); if (!pt) return;
      await touch('touchStart', pt.x, pt.y); await W(650);
      const n = 1 + Math.floor(rnd() * 6), dy = pick([-90, -45, -15, 15, 45, 90]), dx = pick([0, 0, -50, 50]);
      for (let i = 1; i <= n; i++){ await touch('touchMove', pt.x + dx * i / n, pt.y + dy * i / n); await W(30); }
      await touch('touchEnd'); await W(600);
      await settle();
      if (rnd() < 0.5) await p.evaluate(() => { if (ED.on) A.edDone(); }); await W(400);
    },
    resize: async () => {
      await p.click('#tabs [data-t="week"]'); await W(300);
      const pt = await blk(); if (!pt) return;
      await touch('touchStart', pt.x, pt.y); await W(650); await touch('touchEnd'); await W(500);
      const h = await p.evaluate(() => { const e = document.querySelector('.blk.sel .hdl.bot'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      if (h) await drag(h.x, h.y, h.x, h.y + pick([-40, 25, 60, 120]), 20, 6);
      await W(300); await settle(); await p.evaluate(() => { if (ED.on) A.edDone(); }); await W(400);
    },
    resume: async () => { await hide(true); await W(80); await hide(false); await W(500); },
    time: async () => { await p.evaluate(m => { window.__off += m * 60000; tick(); }, pick([1, 7, 30, 95, 600])); await W(300); },
    settings: async () => { await p.click('#tabs [data-t="set"]'); await W(300); const pg = pick(['master', 'away', 'push', 'about']); await p.evaluate(pg => { ui.sub = []; render(); }, pg); await p.click(`#page [data-p="${pg}"]`); await W(450); if (rnd() < 0.6){ await p.evaluate(() => A.back()); await W(400); } },
    theme: async () => { await p.evaluate(v => { D.set.theme = v; save(); applyTheme(); render(); }, pick(['light', 'dark'])); await W(250); },
    todo: async () => { await p.click('#tabs [data-t="prod"]'); await W(300); const i = p.locator('#newTodo'); if (await i.count()){ await i.fill('Test ' + Math.floor(rnd() * 1000)); await i.press('Enter'); await W(350); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await W(200); } },
    done: async () => { await p.click('#tabs [data-t="prod"]'); await W(300); const c = p.locator('[data-a="todoDone"]'); if (await c.count()){ await c.first().click(); await W(700); } },
    focus: async () => {
      await p.click('#tabs [data-t="day"]'); await W(350);
      const k = await p.evaluate(() => { const e = $('.fcs .fk', page); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      if (k){ await touch('touchStart', k.x, k.y); await W(30); await touch('touchEnd'); await W(70); await touch('touchStart', k.x, k.y); await W(30); await touch('touchEnd'); await W(600); }
      else if (await p.locator('.pin').count()){ await p.locator('.pin').click(); await W(600); }
      if (rnd() < .3) await p.evaluate(() => { const f = $('.fti', page); if (f) f.click(); }); await W(500);
    },
    assign: async () => {
      await p.click('#tabs [data-t="prod"]'); await W(300);
      const a = p.locator('[data-a="assignTodo"]'); if (!(await a.count())) return;
      await a.first().click(); await W(600);
      const r = rnd();
      if (r < .3) { await p.evaluate(() => A.weekNext()); await W(700); }
      if (r < .7){ const pt = await blk(); if (pt){ await p.mouse.click(pt.x, pt.y); await W(700); } }
      else if (r < .85){ const c = p.locator('#edbar [data-a="asCancel"]'); if (await c.count()) await c.click(); await W(400); }
      else { await p.click('#tabs [data-t="day"]'); await W(400); }
    }
  };
  const names = Object.keys(acts);
  let okSteps = 0;
  for (let i = 1; i <= N; i++){
    const a = pick(names);
    try { await acts[a](); } catch (e) { ok(false, `Aktion ${a} warf`, e.message); }
    await settle();
    await W(120);
    if (await check(i, a)) okSteps++;
    else { await p.screenshot({ path: `/tmp/claude-0/shots3/stab-fail-${i}.png` }); if (fail > 20) break; }
  }
  console.log(`Belastungstest: ${okSteps}/${N} Schritte ohne Auffälligkeit`);
  ok(!errs.length, 'keine JS-Fehler', errs.join('\n'));
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  console.log('pass', pass, 'fail', fail);
  await b.close();
})();
