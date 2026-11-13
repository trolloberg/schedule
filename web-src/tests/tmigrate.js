// Umzug: Backup aus der Web-App 3.3.0 (so wie sie auf GitHub Pages liegt) sichern und in die iPhone-App 4.0 laden.
// Geprüft wird, dass dabei nichts verloren geht: Master-Woche, Abweichungen, To-Dos, Haken, Zähler, Einstellungen.
// Aufruf: OLD=<Adresse der alten App> node tmigrate.js   (ohne OLD wird die Kopie im Nachbarordner des Servers genommen)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const NEW = 'http://localhost:8099/stundenplan/';
const OLD = process.env.OLD || 'http://localhost:8099/repos/schedule/index.html';
let pass = 0, fail = 0;
const ok = (c, n, extra = '') => { if (c) pass++; else { fail++; console.log('FAIL:', n, String(extra).slice(0, 500)); } };
// JSON mit sortierten Schlüsseln, damit die Reihenfolge der Felder keine Rolle spielt
const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x);
(async () => {
  const b = await chromium.launch();
  const opts = { viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-umzug-'));
  const errs = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errs.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/manifest|favicon|ServiceWorker|service worker/i.test(m.text())) errs.push(tag + ' console: ' + m.text()); });
  };
  // Beide Apps sehen dieselbe Uhrzeit: Montag dieser Woche, 06:00 Uhr
  const clock = off => `window.__off = ${off}; (function () { const RD = Date; class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + window.__off); } static now() { return RD.now() + window.__off; } } window.Date = FD; })();`;

  /* ---------- 1. Alte Web-App 3.3.0: Daten anlegen und Backup sichern ---------- */
  const c1 = await b.newContext(opts);
  const p0 = await c1.newPage();
  await p0.goto(OLD); await p0.waitForTimeout(400);
  const off = await p0.evaluate(() => { const n = new Date(), t = pd(wkStart(today())); t.setHours(6, 0, 0, 0); return t - n; });
  await p0.close();
  await c1.addInitScript(clock(off));
  const p1 = await c1.newPage(); p1.setDefaultTimeout(5000); watch(p1, 'alt');
  const W1 = ms => p1.waitForTimeout(ms);
  await p1.goto(OLD); await W1(600);
  ok(await p1.evaluate(() => APP_VERSION) === '3.3.0', 'alte App ist 3.3.0', await p1.evaluate(() => APP_VERSION));
  ok(await p1.evaluate(() => typeof NATIVE === 'undefined' || NATIVE === false), 'alte App läuft als Web-App');
  const made = await p1.evaluate(() => {
    const t = document.querySelector('.tut'); if (t && t._on) t._on.done();
    loadSample();
    const k = today(), mon = wkStart(k), tue = addD(mon, 1), wed = addD(mon, 2), thu = addD(mon, 3);
    const by = icon => D.slots.find(s => s.icon === icon);
    const work = by('briefcase'), sport = by('barbell'), morning = by('sunny'), dinner = by('restaurant');
    // To-Dos: frei, mit Blocker heute (Priorität, Fälligkeit, Notiz), mit Blocker morgen
    D.todos.push(newTodo('Frei ohne Blocker', null, 0));
    const a = newTodo('Angebot fertig schreiben', { date: k, slot: work.id }, 3); a.due = addD(k, 2); a.note = 'Mit den Zahlen von Tom'; D.todos.push(a);
    D.todos.push(newTodo('Rückruf Steuerberater', { date: tue, slot: work.id }, 1));
    // Abweichungen nur in dieser Woche: Dienstag Arbeit kürzer und umbenannt, Abendessen fällt aus, ein Zusatz-Blocker
    D.ov[tue] = { s: { [work.id]: { e: { start: '08:00', end: '15:00', title: 'Arbeit (kurz)' } }, [dinner.id]: { skip: 1 } },
      x: [{ id: uid(), title: 'Zahnarzt', desc: 'Kontrolle', start: '15:30', end: '16:15', color: 'red', icon: 'briefcase' }] };
    // Donnerstag: Blocker, der aus „Sport“ entstanden ist und dessen To-Dos zeigt
    D.ov[thu] = { s: {}, x: [{ id: uid(), title: 'Sport nachholen', desc: '', start: '17:00', end: '18:00', color: 'green', icon: 'barbell', src: sport.id, rt: true }] };
    // Haken an einem wiederkehrenden To-Do, Änderungen an wiederkehrenden To-Dos nur für einen Tag
    D.chk[k] = { [morning.id]: { [morning.rt[0].id]: 1 } };
    D.rto[wed] = { [sport.id]: { [sport.rt[0].id]: { t: 'Lange dehnen' }, [sport.rt[1].id]: { x: 1 } } };
    // Wochenbewertung aus 3.2 und Zähler der erledigten To-Dos
    D.rev[addD(mon, -7)] = { m: 4, n: 'Gute Woche', l: 'Früher anfangen', at: Date.now() - 5 * 864e5 };
    D.stat = { n: 12, d: { [k]: 3, [addD(k, -1)]: 2, [addD(k, -9)]: 7 } };
    // Einstellungen, auch der alte Push-Server
    Object.assign(D.set, { theme: 'dark', lang: 'de', clock: '24', ws: 1, snap: 10, dur: 45, dayS: 6, dayE: 22, tut: 3 });
    D.set.push = { on: 1, url: 'https://schedule-push.example.workers.dev', lead: 10 };
    save();
    return { k, mon, tue, wed, thu, work: work.id, sport: sport.id, dinner: dinner.id };
  });
  await p1.reload(); await W1(600);   // die alte App liest ihre Daten selbst wieder ein
  const oldD = await p1.evaluate(() => JSON.parse(JSON.stringify(D)));
  ok(oldD.slots.length === 11 && oldD.todos.length === 3 && Object.keys(oldD.ov).length === 2, 'alte App hält die Testdaten', stable({ s: oldD.slots.length, t: oldD.todos.length, ov: Object.keys(oldD.ov) }));
  ok(oldD.v === 5, 'alte App speichert im Format 5', oldD.v);
  // „Backup sichern“ in den Einstellungen (im Test landet die Datei als Download, auf dem iPhone im Teilen-Menü)
  await p1.click('#tabs [data-t="set"]'); await W1(300);
  const [dl] = await Promise.all([p1.waitForEvent('download'), p1.click('[data-a="export"]')]);
  const file = path.join(dir, dl.suggestedFilename());
  await dl.saveAs(file);
  ok(/^schedule-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'Dateiname des Backups', dl.suggestedFilename());
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(backup.app === 'schedule' && backup.version === '3.3.0' && backup.data && backup.data.v === 5, 'Backup stammt aus 3.3.0', stable({ app: backup.app, version: backup.version }));
  ok(stable(backup.data) === stable(oldD), 'Backup enthält genau die Daten der alten App');
  await c1.close();

  /* ---------- 2. iPhone-App 4.0: Backup laden ---------- */
  const c2 = await b.newContext(opts);
  await c2.addInitScript(clock(off));
  await c2.addInitScript(() => {
    window.__msgs = []; window.__perm = 'notDetermined';
    window.webkit = { messageHandlers: { schedule: { postMessage: raw => {
      const m = JSON.parse(JSON.stringify(raw)); window.__msgs.push(m);
      // iOS antwortet auf jeden Abgleich; Erlaubnis gibt es erst, wenn der Schalter getippt wurde (ask)
      if (m.t === 'notify') setTimeout(() => {
        if (m.on && m.ask && window.__perm === 'notDetermined') window.__perm = 'authorized';
        const g = window.__perm === 'authorized' && !!m.on, n = g ? Math.min((m.plan || []).length, 62) : 0;
        if (window.__nativeNotify) window.__nativeNotify({ rid: m.rid, status: window.__perm, granted: window.__perm === 'authorized', n, until: n ? m.plan[n - 1].t : 0 });
      }, 40);
    } } } };
    window.__nativeBoot = { env: null, info: { version: '4.0.0', build: '1', lang: 'de', ios: '26.5', safe: { t: 62, b: 34 } } };
  });
  const p = await c2.newPage(); p.setDefaultTimeout(5000); watch(p, 'neu');
  const W = ms => p.waitForTimeout(ms);
  const msgs = t => p.evaluate(t => window.__msgs.filter(m => m.t === t), t);
  await p.goto(NEW); await W(600);
  ok(await p.evaluate(() => NATIVE === true && APP_VERSION === '4.0.0'), 'neue App ist 4.0.0 in der iPhone-Hülle');
  ok(await p.evaluate(() => today()) === made.k, 'beide Apps sehen denselben Tag', made.k);
  ok(await p.locator('.tut').count() === 1, 'neue App startet mit der Einführung');
  // Weg aus der Anleitung: Überspringen, Einstellungen, Backup laden, Datei wählen, Laden
  await p.click('.tut .skip'); await W(500);
  ok(await p.locator('.tut').count() === 0, 'Überspringen schließt die Einführung');
  await p.click('#tabs [data-t="set"]'); await W(300);
  ok(await p.locator('[data-a="import"]').count() === 1 && /Backup laden/.test(await p.locator('[data-a="import"]').innerText()), 'Eintrag „Backup laden“ steht unter Daten');
  await p.setInputFiles('#imp', file); await W(400);
  ok(/Backup laden\?/.test(await p.locator('.layer.al .at').innerText()), 'Rückfrage „Backup laden?“');
  ok((await p.locator('.layer.al .abt button.b').innerText()).trim() === 'Laden', 'Knopf heißt „Laden“');
  await p.click('.layer.al .abt button.b'); await W(700);
  ok(/Backup geladen/.test(await p.locator('#toast').innerText()), 'Meldung „Backup geladen“', await p.locator('#toast').innerText());
  await W(600);
  const newD = await p.evaluate(() => JSON.parse(JSON.stringify(D)));
  for (const key of ['slots', 'ov', 'chk', 'todos', 'rto', 'rev', 'stat']) ok(stable(newD[key]) === stable(oldD[key]), 'unverändert übernommen: ' + key, stable(newD[key]).slice(0, 200) + ' <> ' + stable(oldD[key]).slice(0, 200));
  const setA = Object.assign({}, newD.set), setB = Object.assign({}, oldD.set); delete setA.push; delete setB.push;
  ok(stable(setA) === stable(setB), 'Einstellungen übernommen', stable(setA) + ' <> ' + stable(setB));
  ok(newD.set.push.lead === 10, 'Vorlauf der Erinnerungen übernommen', stable(newD.set.push));
  ok(newD.set.push.on === 0, 'Schalter für Erinnerungen ist aus, solange iOS nicht gefragt wurde', stable(newD.set.push));
  ok(newD.v === 5, 'Datenformat 5');
  ok(await p.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'dunkles Erscheinungsbild aus dem Backup gilt sofort');
  // Die Kopie in der App enthält den geladenen Stand
  const sv = (await msgs('save')).pop();
  ok(sv && stable(JSON.parse(sv.env).data.slots) === stable(oldD.slots) && JSON.parse(sv.env).data.todos.length === 3, 'Kopie in der App hat den geladenen Stand');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('sp.data.v1')).slots.length) === 11, 'Web-Speicher hat den geladenen Stand');

  /* ---------- 3. Die Woche sieht aus wie vorher ---------- */
  const occs = await p.evaluate(([tue, thu]) => ({ tue: occ(tue).map(o => ({ t: o.title, s: o.start, e: o.end, skipped: !!o.skipped })), thu: occ(thu).map(o => ({ t: o.title, s: o.start, e: o.end })) }), [made.tue, made.thu]);
  ok(occs.tue.some(o => o.t === 'Arbeit (kurz)' && o.s === '08:00' && o.e === '15:00'), 'Dienstag: geänderte Arbeit', stable(occs.tue));
  ok(occs.tue.some(o => o.t === 'Zahnarzt' && o.s === '15:30'), 'Dienstag: Zusatz-Blocker', stable(occs.tue));
  ok(occs.tue.some(o => o.t === 'Abendessen' && o.skipped), 'Dienstag: Abendessen fällt aus', stable(occs.tue));
  ok(occs.thu.some(o => o.t === 'Sport nachholen' && o.s === '17:00'), 'Donnerstag: Blocker aus Sport', stable(occs.thu));
  await p.click('#tabs [data-t="week"]'); await W(500);
  ok(await p.locator('.blk').count() >= 30, 'Woche zeigt die Blocker', await p.locator('.blk').count());
  await p.screenshot({ path: '/tmp/claude-0/shots40/m1-woche-nach-umzug.png' });
  await p.click('#tabs [data-t="day"]'); await W(400);
  ok(/Morgenroutine/.test(await p.locator('#page').innerText()), 'Heute zeigt den nächsten Blocker', (await p.locator('#page').innerText()).slice(0, 120));
  await p.click('#tabs [data-t="prod"]'); await W(400);
  const prod = await p.locator('#page').innerText();
  ok(/Frei ohne Blocker/.test(prod) && /Angebot fertig schreiben/.test(prod) && /Rückruf Steuerberater/.test(prod), 'Productivity zeigt die offenen To-Dos');
  ok(/12/.test(prod), 'Zähler der erledigten To-Dos übernommen', prod.replace(/\s+/g, ' ').slice(0, 200));

  /* ---------- 4. Mitteilungen einschalten wie in der Anleitung ---------- */
  await p.click('#tabs [data-t="set"]'); await W(300);
  await p.click('[data-a="go"][data-p="push"]'); await W(500);
  ok(!(await p.locator('[data-a="pushToggle"].on').count()), 'Schalter steht nach dem Laden auf aus');
  await p.evaluate(() => { window.__msgs.length = 0; });
  await p.click('[data-a="pushToggle"]'); await W(700);
  ok(await p.evaluate(() => D.set.push.on) === 1, 'Schalter an, nachdem iOS erlaubt hat');
  const nf = (await msgs('notify')).filter(m => m.on).pop();
  ok(nf && nf.plan.length > 20, 'Erinnerungen geplant', nf && nf.plan.length);
  const first = nf && nf.plan.map(x => x.t).sort((a, b) => a - b)[0];
  const lead = await p.evaluate(([t, k]) => { const d = new Date(t); return dkey(d) + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }, [first, made.k]);
  ok(lead === made.k + ' 6:20', 'erste Erinnerung 10 Minuten vor der Morgenroutine (Vorlauf aus dem Backup)', lead);
  const tueWork = nf && nf.plan.find(x => /Arbeit \(kurz\)/.test(x.title + ' ' + x.body));
  ok(!!tueWork, 'Erinnerung für den geänderten Dienstag', nf && stable(nf.plan.slice(0, 3)));
  ok(nf && !nf.plan.some(x => { const d = new Date(x.t); return /Abendessen/.test(x.title + ' ' + x.body) && d.getDay() === 2 && x.t < first + 3 * 864e5; }), 'keine Erinnerung für das ausgefallene Abendessen am Dienstag');
  ok(/Erinnerungen sind geplant/.test(await p.locator('#page').innerText()), 'Seite zeigt die geplanten Erinnerungen');

  /* ---------- 5. Neustart: alles bleibt ---------- */
  await p.reload(); await W(600);
  const again = await p.evaluate(() => JSON.parse(JSON.stringify(D)));
  ok(stable(again.slots) === stable(oldD.slots) && stable(again.ov) === stable(oldD.ov) && stable(again.todos) === stable(oldD.todos), 'nach Neustart unverändert');
  ok(await p.locator('.tut').count() === 0, 'keine Einführung mehr nach dem Laden');

  ok(errs.length === 0, 'keine Fehler in der Konsole', errs.join('\n'));
  await b.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ABBRUCH', e); process.exit(2); });
