// Vollständiger Funktionstest für Schedule v3 (390×844, Touch, de-DE, Europe/Berlin)
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://localhost:8099/stundenplan/';
const SH = '/tmp/claude-0/shots33/';
let pass = 0, fail = 0;
const ok = (c, n, extra = '') => { if (c) pass++; else { fail++; console.log('FAIL:', n, String(extra).slice(0, 300)); } };
(async () => {
  const b = await chromium.launch({ channel: 'chromium' });
  const mk = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true, ...opts });
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    return { ctx, p, errs };
  };
  const { ctx, p, errs } = await mk();
  const W = ms => p.waitForTimeout(ms);
  const D = () => p.evaluate(() => JSON.parse(JSON.stringify(D)));
  const tap = async (sel, w = 500) => { await p.click(sel); await W(w); };
  const tileIs = k => p.evaluate(k => { const x = document.createElement('div'); x.innerHTML = I(k); return document.querySelector('.layer:last-of-type .cell [data-tile] svg').innerHTML === x.firstChild.innerHTML; }, k);
  const txt = sel => p.locator(sel).innerText();
  const layers = () => p.locator('.layer').count();
  const closeAll = async () => { for (let i = 0; i < 6 && await layers(); i++){ await p.keyboard.press('Escape'); await W(500); } };
  const top = '.layer:last-of-type';
  const overflow = () => p.evaluate(() => [...document.querySelectorAll('#page *, .layer *, .tut *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !e.closest('.chips') && !e.closest('.tr') && !e.closest('.tbub'); }).map(e => e.className.baseVal ?? e.className).slice(0, 4));

  /* ---------- A: erster Start & Einführung ---------- */
  await p.goto(URL); await W(700);
  ok(await p.locator('.tut').count() === 1, 'tutorial on first start');
  ok(await p.locator('.tut .dots i').count() === 5, 'tutorial has 5 pages');
  ok((await txt('.tut .tp >> nth=0')).includes('Willkommen bei Schedule'), 'welcome page title');
  ok((await overflow()).length === 0, 'no overflow in tutorial', await overflow());
  for (let i = 0; i < 4; i++) await tap('.tut [data-a="next"]', 450);
  ok(await p.locator('.tut [data-a="setup"]').count() === 1 && await p.locator('.tut [data-a="sample"]').count() === 1, 'last page offers setup + sample');
  ok(await p.locator('.tut .skip').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'skip hidden on last page');
  await tap('.tut [data-a="setup"]', 700);
  ok(await p.locator('.tut').count() === 0, 'tutorial closed');
  ok((await D()).set.tut === 3, 'tutorial marked as seen');
  ok(await p.evaluate(() => ui.tab === 'set' && ui.sub[0] === 'master'), 'setup opens master week in settings');
  ok((await txt('#navT')).includes('Master-Woche'), 'master title');
  await p.reload(); await W(600);
  ok(await p.locator('.tut').count() === 0, 'tutorial not shown again');
  ok(await p.locator('.welcome').count() === 1, 'welcome card on empty today');
  ok(await p.locator('[data-a="addOne"], [data-a="addToday"]').count() === 0 && !(await txt('#page')).includes('Nur heute hinzufügen'), 'no "+ Nur heute hinzufügen" button');

  /* ---------- B: Blocker im Master anlegen ---------- */
  await tap('#tabs [data-t="set"]'); await tap('[data-a="go"][data-p="master"]');
  await tap('#navR [data-a="addTpl"]', 650);
  ok((await txt(`${top} .sht`)) === 'Neuer Blocker', 'editor title');
  ok(await p.locator(`${top} .seg`).count() === 0, 'no type (routine) choice in master editor');
  ok(!(await txt(`${top} .sb`)).includes('Routine'), 'no Routine wording');
  await p.fill(`${top} [name="title"]`, 'Fußball Training'); await W(150);
  ok(await tileIs('football'), 'auto icon from name: football');
  ok(await p.locator(`${top} .dis.open`).count() === 0, 'appearance dropdown closed at start');
  await tap(`${top} .cell [data-tile]`, 450);
  ok(await p.locator(`${top} .dis.open`).count() === 1, 'tile opens dropdown');
  ok(await p.locator(`${top} .cols button`).count() === 24 && await p.locator(`${top} .cols label input[type=color]`).count() === 1, '24 colours + custom colour');
  ok(await p.locator(`${top} .icons`).count() === 5 && await p.locator(`${top} .icons button`).count() >= 90, 'icons in 5 categories', await p.locator(`${top} .icons button`).count());
  const subh = await p.locator(`${top} .subh`).allInnerTexts();
  ok(subh.join('|').toLowerCase().includes('sport'), 'category headings', subh.join('|'));
  await p.screenshot({ path: SH + 'f-editor-look.png' });
  await tap(`${top} .cols button[data-v="forest"]`, 200);
  ok(await p.locator(`${top} .cell [data-tile]`).getAttribute('class') === 'tile c-forest', 'colour applied to tile');
  ok(await p.locator(`${top} .dis.open`).count() === 1, 'dropdown stays open after colour');
  await tap(`${top} .icons button[data-v="trophy"]`, 200);
  ok(await tileIs('trophy'), 'icon picked');
  await p.fill(`${top} [name="title"]`, 'Fußball Training am Abend'); await W(100);
  ok(await tileIs('trophy'), 'manual icon not overwritten by suggestion');
  await tap(`${top} [data-a="look"].dh2`, 400);
  ok(await p.locator(`${top} .dis.open`).count() === 0, 'dropdown closes');
  await p.fill(`${top} [name="desc"]`, 'Halle 2, Schuhe mitnehmen.');
  await p.fill(`${top} [name="start"]`, '18:00'); await p.fill(`${top} [name="end"]`, '19:30'); await W(100);
  ok((await txt(`${top} #edur`)) === '1 Std. 30 Min.', 'duration shown', await txt(`${top} #edur`));
  await tap(`${top} [data-a="preset"][data-v="1,2,3,4,5"]`, 250);
  await tap(`${top} .days [data-v="6"]`, 250);
  await p.fill(`${top} [name="nrt"]`, 'Tasche packen'); await p.press(`${top} [name="nrt"]`, 'Enter'); await W(250);
  await p.fill(`${top} [name="nrt"]`, 'Trinkflasche'); await tap(`${top} [data-a="addRt"]`, 250);
  ok(await p.locator(`${top} [name^="rt"]`).count() === 2, 'two recurring to-dos in editor');
  await tap(`${top} [data-a="delRt"][data-i="1"]`, 250);
  ok(await p.locator(`${top} [name^="rt"]`).count() === 1, 'remove recurring to-do');
  await p.screenshot({ path: SH + 'f-editor-full.png' });
  await tap(`${top} [data-a="_right"]`, 650);
  let d = await D();
  const fb = d.slots.find(s => s.title === 'Fußball Training am Abend');
  ok(fb && fb.color === 'forest' && fb.icon === 'trophy' && fb.desc === 'Halle 2, Schuhe mitnehmen.' && fb.start === '18:00' && fb.end === '19:30', 'block saved with look, desc, time', JSON.stringify(fb));
  ok(fb && JSON.stringify(fb.days) === '[1,2,3,4,5,6]' && fb.rt.length === 1 && fb.rt[0].title === 'Tasche packen', 'days + recurring to-do saved', JSON.stringify(fb));
  ok(await p.locator('.mweek .mk').count() >= 6, 'mini week shows block');
  // Validierung
  await tap('#navR [data-a="addTpl"]', 650);
  await tap(`${top} [data-a="_right"]`, 400);
  ok(await layers() === 1 && (await txt('#toast')).includes('Namen'), 'name required');
  await p.fill(`${top} [name="title"]`, 'X'); await p.fill(`${top} [name="start"]`, '10:00'); await p.fill(`${top} [name="end"]`, '09:00');
  await tap(`${top} [data-a="_right"]`, 400);
  ok(await layers() === 1 && (await txt('#toast')).includes('Ende'), 'end after start required');
  // eigene Farbe
  await p.fill(`${top} [name="end"]`, '11:00');
  await tap(`${top} .cell [data-tile]`, 400);
  await p.evaluate(() => { const i = document.querySelector('.layer:last-of-type input[type=color]'); i.value = '#12a4b6'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await W(150);
  ok(await p.locator(`${top} .cell [data-tile]`).getAttribute('class') === 'tile c-x12a4b6', 'custom colour class');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.layer:last-of-type .cell [data-tile]')).getPropertyValue('--c').trim() === '#12a4b6'), 'custom colour variable');
  await tap(`${top} [data-a="_right"]`, 650);
  d = await D(); ok(d.slots.some(s => s.title === 'X' && s.color === '#12a4b6'), 'custom colour saved');
  // Löschen mit Rückgängig
  await p.locator('.cell[data-a="editTpl"]', { hasText: 'X' }).first().click(); await W(650);
  await tap(`${top} [data-a="del"]`, 600);
  d = await D(); ok(!d.slots.some(s => s.title === 'X'), 'block deleted');
  await tap('#toast [data-a="_undo"]', 400);
  d = await D(); ok(d.slots.some(s => s.title === 'X'), 'undo delete');

  /* ---------- C: Alle Daten löschen, Beispielwoche, Heute ---------- */
  await tap('[data-a="back"]');
  await tap('[data-a="wipe"]', 400);
  await tap('.layer.al button.d', 500);
  d = await D(); ok(d.slots.length === 0 && d.set.tut === 3, 'wipe keeps settings');
  await tap('#tabs [data-t="day"]');
  await tap('.welcome [data-a="sample"]', 600);
  d = await D(); ok(d.slots.length === 11 && d.slots.every(s => s.icon && s.desc !== undefined), 'sample week (11 blocks)');
  ok(await p.locator('.fcs').count() === 1, 'today opens in focus mode');
  await p.evaluate(() => dayMode(true)); await W(450);
  const t = await p.evaluate(() => today());
  const occN = await p.evaluate(() => occ(today()).length);
  ok(await p.locator('.tlr').count() === occN, 'timeline rows = blocks today', occN);
  ok(await p.locator('#navR [data-a="editToday"]').count() === 1, 'pencil on today');
  const wd = await p.evaluate(() => wdOf(today()));
  if (wd <= 5){
    const mr = await p.evaluate(() => occ(today()).find(o => o.title === 'Morgenroutine'));
    await tap(`.tlr[data-id="${mr.id}"] .tdl button >> nth=0`, 300);
    d = await D(); ok(d.chk[t] && d.chk[t][mr.id] && Object.keys(d.chk[t][mr.id]).length === 1, 'recurring to-do checked on timeline');
    ok(await p.locator('.layer').count() === 0, 'checking does not open sheet');
    await tap(`.tlr[data-id="${mr.id}"] .tdl button >> nth=0`, 300);
    d = await D(); ok(!d.chk[t], 'recurring to-do unchecked');
  }
  ok((await overflow()).length === 0, 'no overflow on today', await overflow());
  await p.screenshot({ path: SH + 'f-today.png' });

  /* ---------- D: Woche ---------- */
  await tap('#tabs [data-t="week"]', 600);
  const days = await p.evaluate(() => WK.days);
  ok(days.length === 7 && await p.locator('.wk-c').count() === 7, '7 day columns');
  ok(await p.locator('.lgd, .legend, .lg').count() === 0, 'no legend');
  const widths = await p.evaluate(() => [...document.querySelectorAll('.blk')].map(b => b.parentElement.getBoundingClientRect().width - b.getBoundingClientRect().width));
  ok(widths.every(w => w > 3 && w < 6), 'blocks fill full day width', widths.filter(w => !(w > 3 && w < 6)).join(',') + ' / ' + widths.length);
  // Überlappung + sehr kurzer Block
  await p.evaluate(k => { ensureOv(k).x.push({ id: 'ov1', title: 'Telefonat', desc: '', start: '09:00', end: '09:10', color: 'pink', icon: 'call' }); save(); render(); }, days[2]);
  ok(await p.evaluate(k => { const e = blockEl(k, 'ov1'); return e.classList.contains('ovl') && e.classList.contains('short'); }, days[2]), 'overlapping short block gets fade/blur class');
  ok(await p.evaluate(k => { const e = blockEl(k, 'ov1'); return getComputedStyle(e).backdropFilter.includes('blur') || getComputedStyle(e).webkitBackdropFilter?.includes('blur'); }, days[2]), 'overlap uses blur');
  ok(await p.evaluate(k => { const e = blockEl(k, 'ov1'), a = blockEl(k, occ(k).find(o => o.title === 'Arbeit').id); return Math.abs(e.getBoundingClientRect().width - a.getBoundingClientRect().width) < 1; }, days[2]), 'overlapping block also full width (not side by side)');
  await p.evaluate(() => { scroller.scrollTop = (8 * 60 - WK.H0 * 60) * PPM - 100; }); await W(150);
  await p.screenshot({ path: SH + 'f-week-overlap.png' });
  // Tippen = Details mit Wiederholung
  const sp = await p.evaluate(k => occ(k).find(o => o.title === 'Sport').id, days[0]);
  await p.evaluate(([k, id]) => blockEl(k, id).scrollIntoView({ block: 'center' }), [days[0], sp]); await W(200);
  await p.evaluate(([k, id]) => blockEl(k, id).click(), [days[0], sp]); await W(650);
  let det = await txt('.sheet.float');
  ok(det.includes('Sport') && det.includes('Gym') && /Mo, Mi, Fr/.test(det) && det.includes('Nächstes Mal'), 'detail: name, description, repeat days, next', det);
  ok(await p.locator('.sheet.float .wdots span.on').count() === 3, 'detail: 3 repeat days highlighted');
  const tdv = () => p.$$eval('.sheet.float input.tdi', a => a.map(x => x.value).join('|'));
  ok(/Dehnen/.test(await tdv()) && /Protein-Shake/.test(await tdv()), 'detail: recurring to-dos');
  // To-Do „Bei jedem Termin“
  await tap('.sheet.float [data-a="addTd"]', 600);
  ok(await p.locator(`${top} .seg button`).count() === 2, 'to-do scope choice');
  await tap(`${top} [data-a="ev"][data-v="1"]`, 250);
  await p.fill(`${top} [name="nt"]`, 'Handtuch'); await tap(`${top} [data-a="add"]`, 600);
  d = await D(); ok(d.slots.find(s => s.title === 'Sport').rt.some(r => r.title === 'Handtuch'), '"every time" adds recurring to-do to master');
  ok((await tdv()).includes('Handtuch'), 'detail shows new recurring to-do');
  await tap('.sheet.float [data-a="addTd"]', 600);
  await p.fill(`${top} [name="nt"]`, 'Neue Schuhe testen'); await tap(`${top} [data-a="add"]`, 600);
  d = await D(); ok(d.todos.some(x => x.title === 'Neue Schuhe testen' && x.at && x.at.date === days[0] && x.at.slot === sp), 'one-off to-do assigned');
  await closeAll();
  // Tag-Kopf
  await tap(`.hd[data-d="${days[3]}"]`, 500);
  ok((await txt('.layer.as')).includes('Blocker nur an diesem Tag'), 'day header action sheet');
  await tap('.layer.as .asc', 450);
  // Bearbeiten-Knopf, Auswahl, Menü
  await tap('[data-a="edStart"]', 500);
  ok(await p.evaluate(() => ED.on) && await p.locator('#navR [data-a="edDone"][aria-label="Fertig"]').count() === 1 && await p.locator('#navL [data-a="edUndo"]').count() === 1, 'edit mode via button');
  ok(await p.locator('.edhint').count() === 1, 'edit hint');
  const ab = await p.evaluate(k => occ(k).find(o => o.title === 'Abendessen').id, days[1]);
  await p.evaluate(([k, id]) => blockEl(k, id).scrollIntoView({ block: 'center' }), [days[1], ab]); await W(200);
  await p.evaluate(([k, id]) => blockEl(k, id).click(), [days[1], ab]); await W(400);
  ok(await p.evaluate(() => ED.sel && ED.sel.k === WK.days[1]), 'tap selects in edit mode');
  ok(await layers() === 0, 'tap in edit mode opens no sheet');
  await p.evaluate(([k, id]) => blockEl(k, id).click(), [days[1], ab]); await W(500);
  ok(await p.locator('.layer.pl').count() === 1, 'tap on selected block opens menu');
  const items = await p.locator('.layer.pl .pop button').allInnerTexts();
  ok(['Duplizieren', 'Aufteilen', 'To-Do hinzufügen', 'Details', 'Löschen'].every(x => items.some(i => i.includes(x))), 'menu items', items.join('|'));
  await tap('.layer.pl button:has-text("Details")', 650);
  ok(await p.locator('.sheet.float').count() === 1, 'menu: details');
  await closeAll();
  // Neuer Blocker aus der Woche
  await tap('#navR [data-a="edAdd"]', 650);
  ok(await p.locator(`${top} .daypick button`).count() === 7, 'new block: day picker for the week');
  await tap(`${top} .daypick [data-v="${days[5]}"]`, 300);
  await p.fill(`${top} [name="title"]`, 'Kino');
  await p.fill(`${top} [name="start"]`, '20:00'); await p.fill(`${top} [name="end"]`, '22:00');
  await tap(`${top} [data-a="_right"]`, 650);
  d = await D(); ok(d.ov[days[5]] && d.ov[days[5]].x.some(x => x.title === 'Kino' && x.icon === 'film'), 'one-off block added to chosen day with auto icon');
  ok(await p.evaluate(() => ED.on && ED.sel && occ(ED.sel.k).find(o => o.id === ED.sel.id).title === 'Kino'), 'new block is selected');
  await tap('#navR [data-a="edDone"]', 500);
  ok(!(await p.evaluate(() => ED.on)), 'Fertig ends edit mode');
  // Heute-Stift
  await tap('#tabs [data-t="day"]'); await tap('#navR [data-a="editToday"]', 700);
  ok(await p.evaluate(() => ui.tab === 'week' && ED.on && ui.week === wkStart(today())), 'pencil opens week edit mode');
  await tap('#tabs [data-t="prod"]', 500);
  ok(!(await p.evaluate(() => ED.on)), 'leaving week ends edit mode');
  // Woche wechseln
  await tap('#tabs [data-t="week"]', 500);
  await tap('#navR [data-a="weekNext"]', 500);
  ok(await p.evaluate(() => ui.week === addD(wkStart(today()), 7)), 'next week');
  ok(await p.locator('[data-a="weekNow"]').count() === 1, '"Diese Woche" pill');
  await tap('[data-a="weekNow"]', 500);

  /* ---------- E: Einstellungen ---------- */
  await tap('#tabs [data-t="set"]', 500);
  ok(await p.locator('#tabs [data-t="set"] span').innerText() === 'Einstellungen', 'settings tab replaces master');
  await p.screenshot({ path: SH + 'f-settings.png' });
  await tap('[data-a="theme"][data-v="dark"]', 400);
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark' && (await D()).set.theme === 'dark', 'dark mode');
  ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(0, 0, 0)', 'dark background');
  await p.screenshot({ path: SH + 'f-settings-dark.png' });
  await tap('#tabs [data-t="week"]', 500); await p.screenshot({ path: SH + 'f-week-dark.png' });
  await tap('#tabs [data-t="day"]', 500); await p.screenshot({ path: SH + 'f-today-dark.png' });
  await tap('#tabs [data-t="set"]', 500);
  await tap('[data-a="themeAuto"]', 300);
  ok((await D()).set.theme === 'auto', 'automatic theme');
  await tap('[data-a="theme"][data-v="light"]', 300);
  // Sprache
  await tap('[data-a="opt"][data-o="lang"]', 450);
  await tap('.layer.pl button:has-text("English")', 500);
  ok((await txt('#tabs')).includes('Today') && (await txt('#tabs')).includes('Settings'), 'tabs in English');
  ok(/appearance/i.test(await txt('#page')), 'settings in English');
  await tap('#tabs [data-t="day"]', 400);
  ok((await txt('.lt')) === 'Today' && /^[A-Z][a-z]+day, [A-Z][a-z]+ \d+$/.test(await txt('.lts')), 'today in English', await txt('.lts'));
  ok((await overflow()).length === 0, 'no overflow in English', await overflow());
  await tap('#tabs [data-t="set"]', 400);
  // 12 Stunden
  await tap('[data-a="opt"][data-o="clock"]', 450);
  await tap('.layer.pl button:has-text("12-hour")', 450);
  await tap('#tabs [data-t="week"]', 500);
  ok(/AM|PM/.test(await txt('.wk-t')), 'week ruler in 12h');
  await p.screenshot({ path: SH + 'f-week-en12.png' });
  await tap('#tabs [data-t="set"]', 400);
  await tap('[data-a="opt"][data-o="clock"]', 450); await tap('.layer.pl button:has-text("24-hour")', 400);
  await tap('[data-a="opt"][data-o="lang"]', 450); await tap('.layer.pl button:has-text("Deutsch")', 450);
  ok((await txt('#tabs')).includes('Heute'), 'back to German');
  // Woche beginnt Sonntag
  await tap('[data-a="opt"][data-o="ws"]', 450); await tap('.layer.pl button:has-text("Sonntag")', 400);
  await tap('#tabs [data-t="week"]', 500);
  ok((await p.locator('.hd >> nth=0').innerText()).startsWith('SO') || (await p.locator('.hd >> nth=0').innerText()).startsWith('So'), 'week starts Sunday', await p.locator('.hd >> nth=0').innerText());
  await tap('#tabs [data-t="set"]', 400);
  await tap('[data-a="opt"][data-o="ws"]', 450); await tap('.layer.pl button:has-text("Montag")', 400);
  await tap('[data-a="opt"][data-o="snap"]', 450); await tap('.layer.pl button:has-text("30 Min.")', 400);
  await tap('[data-a="opt"][data-o="dur"]', 450); await tap('.layer.pl button:has-text("1 Std. 30 Min.")', 400);
  d = await D(); ok(d.set.snap === 30 && d.set.dur === 90 && d.set.ws === 1, 'snap + default length saved');
  await tap('#tabs [data-t="set"]', 300); await tap('[data-a="go"][data-p="master"]'); await tap('#navR [data-a="addTpl"]', 650);
  const st = await p.inputValue(`${top} [name="start"]`), en = await p.inputValue(`${top} [name="end"]`);
  ok(await p.evaluate(([a, b]) => tmin(b) - tmin(a), [st, en]) === 90, 'new block uses default length', st + '-' + en);
  await closeAll(); await tap('[data-a="back"]');
  // Ferien
  await tap('[data-a="go"][data-p="away"]'); await tap('[data-a="rangeSkip"]', 650);
  await tap(`${top} [data-a="len"][data-v="7"]`, 300);
  await tap(`${top} [data-a="all"]`, 300);
  const n7 = await p.evaluate(() => { let n = 0; for (let k = today(); k <= addD(today(), 6); k = addD(k, 1)) for (const s of D.slots) if (s.days.includes(wdOf(k))) n++; return n; });
  ok((await txt(`${top} .gf`)).includes(`${n7} Termine`), 'holiday count', n7);
  await tap(`${top} [data-a="_right"]`, 650);
  ok(await p.evaluate(() => occ(today()).every(o => o.skipped)), 'holidays skip today');
  await tap('[data-a="resetAll"]', 500);
  ok(await p.evaluate(() => occ(today()).some(o => !o.skipped)), 'reset all');
  await tap('[data-a="back"]');
  // Mitteilungen
  await tap('[data-a="go"][data-p="push"]', 500);
  ok((await txt('#page')).includes('Home-Bildschirm'), 'push page explains home screen');
  await p.fill('#purl', 'ftp://nope'); await p.press('#purl', 'Enter'); await W(300);
  ok((await txt('#toast')).includes('https'), 'invalid url rejected');
  await p.fill('#purl', 'schedule-push.nick.workers.dev/'); await p.press('#purl', 'Enter'); await W(400);
  d = await D(); ok(d.set.push.url === 'https://schedule-push.nick.workers.dev', 'url normalised + saved', d.set.push.url);
  await tap('[data-a="pushToggle"]', 400);
  ok((await txt('#toast')).includes('Home-Bildschirm') && !(await D()).set.push.on, 'push needs home screen app');
  await tap('[data-a="back"]');
  await tap('[data-a="go"][data-p="about"]', 400);
  ok((await txt('#page')).includes('Ionicons') && (await txt('#page')).includes('MIT'), 'licence line');
  await tap('[data-a="back"]');
  ok((await overflow()).length === 0, 'no overflow in settings', await overflow());

  /* ---------- F: To-Dos ---------- */
  await tap('#tabs [data-t="prod"]', 400);
  await p.fill('#newTodo', 'Steuer machen'); await p.press('#newTodo', 'Enter'); await W(300);
  d = await D(); const td = d.todos.find(x => x.title === 'Steuer machen');
  ok(td && !td.at, 'todo added');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'newTodo'), 'input keeps focus for the next to-do');
  // Zuordnen über die Wochenansicht: ein Tipp auf einen Blocker
  await tap(`[data-a="assignTodo"][data-id="${td.id}"]`, 650);
  ok(await p.evaluate(() => ui.tab === 'week' && !!ui.assign), 'assign opens week');
  ok((await txt('#edbar')).includes('Steuer machen'), 'assign bar names the to-do');
  ok(await p.locator('[data-a="edStart"]').count() === 0, 'no edit pill while assigning');
  await tap('.blk[data-a="asPick"] >> nth=0', 650);
  d = await D(); ok(d.todos.find(x => x.id === td.id).at, 'todo assigned via week');
  ok(await p.evaluate(() => ui.tab === 'prod' && !ui.assign), 'back on productivity after assigning');
  const n0 = d.stat.n;
  await tap(`[data-a="todoDone"][data-id="${td.id}"]`, 700);
  d = await D(); ok(!d.todos.some(x => x.id === td.id) && d.stat.n === n0 + 1, 'done todo deleted and counted', d.stat.n);
  await tap('#toast [data-a="_undo"]', 400);
  d = await D(); ok(d.todos.some(x => x.id === td.id) && d.stat.n === n0, 'done undo');
  await tap(`[data-a="openTodo"][data-id="${td.id}"]`, 650);
  await tap(`${top} [data-a="del"]`, 600);
  d = await D(); ok(!d.todos.some(x => x.id === td.id) && d.stat.n === n0, 'todo deleted (not counted)');
  await tap('#toast [data-a="_undo"]', 400);
  d = await D(); ok(d.todos.some(x => x.id === td.id), 'todo undo');

  /* ---------- G: Erinnerungen (App-Seite) ---------- */
  const plan = await p.evaluate(() => { D.set.push.lead = 0; return notifyPlan(3); });
  ok(plan.length > 3 && plan.every(x => x.t > Date.now() && x.title && x.body && x.tag), 'notify plan entries', plan.length);
  const p10 = await p.evaluate(() => { D.set.push.lead = 10; const a = notifyPlan(2)[0]; D.set.push.lead = 0; return a; });
  ok(p10.title.startsWith('In 10 Min.:'), 'lead time title', p10.title);
  // Abgleich mit nachgebautem Push-Abo: Der Server bekommt nur Uhrzeiten
  let syncBody = null;
  await p.route('https://push.test/**', async r => { if (r.request().url().endsWith('/sync')) syncBody = r.request().postData(); await r.fulfill({ status: 200, body: 'ok', headers: { 'access-control-allow-origin': '*' } }); });
  const syncOk = await p.evaluate(async () => {
    const fake = { endpoint: 'https://web.push.apple.com/abc', toJSON(){ return { endpoint: this.endpoint, keys: { p256dh: 'x', auth: 'y' } }; } };
    const reg = await navigator.serviceWorker.ready;
    Object.defineProperty(reg.pushManager, 'getSubscription', { value: async () => fake, configurable: true });
    D.set.push.on = 1; D.set.push.url = 'https://push.test';
    const r = await pushSync(); D.set.push.on = 0; return r;
  });
  ok(syncOk === true, 'push sync ok');
  const sb = JSON.parse(syncBody || '{}');
  ok(Array.isArray(sb.times) && sb.times.length > 5 && sb.times.every(Number.isInteger), 'server gets times', (syncBody || '').slice(0, 120));
  ok(!/Sport|Arbeit|Abendessen|Morgenroutine|title|body/.test(syncBody || ''), 'server gets no names');
  const idbPlan = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('schedule', 1); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('plan'); g.onsuccess = () => res(g.result); }; }));
  ok(Array.isArray(idbPlan) && idbPlan.length === sb.times.length || idbPlan.length >= sb.times.length, 'plan stored on device (IndexedDB)');
  // Service Worker zeigt die passende Mitteilung
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:8099' });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('ServiceWorker.enable');
  const regId = await new Promise(res => { cdp.on('ServiceWorker.workerRegistrationUpdated', e => { const r = e.registrations.find(x => x.scopeURL.includes('/stundenplan/')); if (r) res(r.registrationId); }); setTimeout(() => res(null), 3000); });
  if (regId){
    const first = idbPlan[0];
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: 'http://localhost:8099', registrationId: regId, data: JSON.stringify({ t: first.t }) });
    await W(800);
    const notes = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => ({ title: n.title, body: n.body, tag: n.tag })));
    const sameT = idbPlan.filter(x => Math.abs(x.t - first.t) < 60e3);
    ok(notes.length >= 1 && notes.some(n => sameT.some(x => n.title.includes(x.title))), 'service worker shows notification from local plan', JSON.stringify(notes));
  } else ok(false, 'service worker registration id');

  /* ---------- H: Backup ---------- */
  await tap('#tabs [data-t="set"]', 400);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-a="export"]')]);
  const exp = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(exp.app === 'schedule' && exp.data.v === 5 && exp.data.slots.length === 11 && dl.suggestedFilename().startsWith('schedule-backup-'), 'export backup');
  await p.setInputFiles('#imp', '/tmp/claude-0/exp.json'); await W(500);
  await tap('.layer.al button.b', 600);
  d = await D();
  ok(d.v === 5 && d.slots.length === 11 && d.slots.every(s => !('type' in s)), 'import v2 backup -> v3 without routines');
  ok(d.slots.find(s => s.title === 'Sport').icon === 'barbell' && d.slots.find(s => s.title === 'Fußball').icon === 'football', 'old icons mapped to Apple-like symbols');
  ok(Object.keys(d.chk).length === 0, 'old routine checks dropped');

  /* ---------- I: Datenübernahme beim Start ---------- */
  const v2raw = JSON.stringify(JSON.parse(fs.readFileSync('/tmp/claude-0/exp.json', 'utf8')).data);
  const m2 = await mk(); await m2.p.addInitScript(raw => { if (!sessionStorage.getItem('x')){ sessionStorage.setItem('x', 1); localStorage.clear(); localStorage.setItem('sp.data.v1', raw); } }, v2raw);
  await m2.p.goto(URL); await m2.p.waitForTimeout(700);
  const d2 = await m2.p.evaluate(() => ({ v: JSON.parse(localStorage.getItem('sp.data.v1')).v, n: D.slots.length, bk: !!localStorage.getItem('sp.backup.v2'), tut: !!document.querySelector('.tut'), todos: D.todos.length }));
  ok(d2.v === 5 && d2.n === 11 && d2.bk, 'v2 data migrated on start + raw backup kept', JSON.stringify(d2));
  ok(d2.tut, 'existing v2 user sees the new introduction once');
  ok(m2.errs.length === 0, 'no errors after v2 migration', m2.errs.join('\n'));
  await m2.ctx.close();
  const v1raw = JSON.stringify(JSON.parse(fs.readFileSync('/tmp/claude-0/backup.json', 'utf8')).data);
  const m1 = await mk(); await m1.p.addInitScript(raw => { if (!sessionStorage.getItem('x')){ sessionStorage.setItem('x', 1); localStorage.clear(); localStorage.setItem('sp.data.v1', raw); } }, v1raw);
  await m1.p.goto(URL); await m1.p.waitForTimeout(700);
  const d1 = await m1.p.evaluate(() => ({ v: D.v, n: D.slots.length, sport: D.slots.find(s => s.title === 'Sport'), bk: !!localStorage.getItem('sp.backup.v1') }));
  ok(d1.v === 5 && d1.n > 5 && d1.bk, 'v1 data migrated', JSON.stringify(d1).slice(0, 200));
  ok(d1.sport && d1.sport.desc.includes('Gym'), 'v1 note becomes description');
  ok(m1.errs.length === 0, 'no errors after v1 migration', m1.errs.join('\n'));
  await m1.ctx.close();

  /* ---------- J: Offline ---------- */
  await p.evaluate(() => navigator.serviceWorker.ready); await W(300);
  await ctx.setOffline(true);
  await p.reload(); await W(800);
  ok(await p.locator('#tabs button').count() === 4 && (await txt('#page')).length > 20, 'works offline after first visit');
  await ctx.setOffline(false);

  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  console.log(`pass ${pass} fail ${fail}`);
  await b.close();
})();
