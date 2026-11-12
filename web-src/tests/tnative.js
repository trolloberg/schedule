// Tests für die iPhone-App (4.0): Die Brücke zur App wird nachgestellt (window.webkit.messageHandlers.schedule).
// Geprüft wird: zweite Datenkopie und Wiederherstellen, Erinnerungen ohne Server, Sichern über die App,
// Statusleiste, Tippgefühl, Texte ohne Server und Home-Bildschirm, Hinweis vor dem Ablauf, Abstände am Bildschirmrand.
const { chromium } = require('playwright');
const URL = 'http://localhost:8099/stundenplan/';
let pass = 0, fail = 0;
const ok = (c, n, extra = '') => { if (c) pass++; else { fail++; console.log('FAIL:', n, String(extra).slice(0, 400)); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error' && !/manifest|favicon/i.test(m.text())) errs.push('console: ' + m.text()); });
  const W = ms => p.waitForTimeout(ms);
  const SH = '/tmp/claude-0/shots40/';
  require('fs').mkdirSync(SH, { recursive: true });
  const tap = async (sel, ms = 350) => { await p.click(sel); await W(ms); };
  const top = '.layer:last-of-type';
  await p.addInitScript(() => {
    // Uhr verstellbar wie in den anderen Tests
    window.__off = +(sessionStorage.getItem('off') || 0); const RD = Date;
    class FD extends RD { constructor(...a){ if (a.length) super(...a); else super(RD.now() + window.__off); } static now(){ return RD.now() + window.__off; } }
    window.Date = FD;
    // Brücke zur App
    if (sessionStorage.getItem('web') !== '1'){
      window.__msgs = [];
      window.webkit = { messageHandlers: { schedule: { postMessage: m => { window.__msgs.push(JSON.parse(JSON.stringify(m))); } } } };
      let info = {}; try { info = JSON.parse(sessionStorage.getItem('info') || '{}'); } catch (e) {}
      window.__nativeBoot = { env: sessionStorage.getItem('env') || null, info };
    }
  });
  const msgs = t => p.evaluate(t => window.__msgs.filter(m => m.t === t), t);
  const clearMsgs = () => p.evaluate(() => { window.__msgs.length = 0; });
  const last = async t => { const l = await msgs(t); return l[l.length - 1] || null; };
  const setNow = (wd, hh, mm = 0) => p.evaluate(([wd, hh, mm]) => { const n = new Date(); const ws = wkStart(today()); const t = pd(addD(ws, wd - 1)); t.setHours(hh, mm, 0, 0); window.__off += t - n; sessionStorage.setItem('off', String(window.__off)); }, [wd, hh, mm]);
  const safeArea = () => p.addStyleTag({ content: ':root{--safe-t:62px !important;--safe-b:34px !important}' });

  /* ---------- 1. Start in der App ---------- */
  await p.goto(URL); await W(500);
  ok(await p.evaluate(() => NATIVE === true), 'NATIVE erkannt');
  ok(await p.evaluate(() => APP_VERSION) === '4.0.0', 'Version 4.0.0');
  const rdy = await last('ready');
  ok(rdy && rdy.v === '4.0.0', 'ready gemeldet', JSON.stringify(rdy));
  ok(await p.locator('.tut').count() === 1, 'Einführung beim ersten Start');
  ok(/Heute zeigt groß/.test(await p.locator('.tut').innerText()), 'Einführung: neuer Text zu Heute');
  ok((await p.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.length) : 0)) === 0, 'kein Service Worker in der App');
  const bar0 = await last('bar');
  ok(bar0 && bar0.bg === '#f2f2f7' && bar0.light === false && bar0.theme === 'auto', 'Statusleiste beim Start hell', JSON.stringify(bar0));

  /* ---------- 2. Speichern legt eine Kopie in der App ab ---------- */
  await tap('.tut [data-a="done"]', 500);
  await p.evaluate(() => loadSample()); await W(300);
  const sv = await last('save');
  ok(sv && typeof sv.env === 'string' && sv.mod > 0, 'save mit Kopie');
  const env = JSON.parse(sv.env);
  ok(env.app === 'schedule' && env.version === '4.0.0' && env.mod === sv.mod, 'Kopie im Backup-Format', JSON.stringify(Object.keys(env)));
  ok(env.data.slots.length === 11 && env.data.v === 5, 'Kopie enthält die Master-Woche');
  const ls = await p.evaluate(() => ({ d: localStorage.getItem('sp.data.v1'), m: +localStorage.getItem('sp.mod') }));
  ok(JSON.stringify(env.data) === ls.d, 'Kopie = Web-Speicher');
  ok(ls.m === sv.mod, 'gleicher Zeitstempel');
  ok(!('mod' in JSON.parse(ls.d)), 'Datenformat unverändert (kein mod in den Daten)');

  /* ---------- 3. Wiederherstellen ---------- */
  // a) Web-Speicher leer, Kopie da: Daten kommen zurück und landen wieder im Web-Speicher
  const envA = sv.env;
  await p.evaluate(e => { localStorage.clear(); sessionStorage.setItem('env', e); }, envA);
  await p.reload(); await W(500);
  ok(await p.evaluate(() => D.slots.length) === 11, 'aus Kopie wiederhergestellt');
  ok(await p.evaluate(() => RESTORED === true), 'RESTORED gesetzt');
  ok(await p.locator('.tut').count() === 0, 'keine Einführung nach Wiederherstellen');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('sp.data.v1')).slots.length) === 11, 'Web-Speicher wieder gefüllt');
  ok((await msgs('save')).length >= 1, 'Kopie nach Wiederherstellen neu geschrieben');
  ok(await p.evaluate(() => window.__nativeBoot.env === null), 'Kopie nach dem Lesen freigegeben');
  // b) Web-Speicher neuer als Kopie: Web-Speicher gilt
  await p.evaluate(() => { D.slots.pop(); save(); }); await W(100);
  await p.reload(); await W(400);   // env in sessionStorage ist jetzt älter
  ok(await p.evaluate(() => D.slots.length) === 10, 'neuerer Web-Speicher gewinnt');
  ok(await p.evaluate(() => RESTORED === false), 'nicht wiederhergestellt');
  // c) Kopie neuer als Web-Speicher: Kopie gilt
  await p.evaluate(e => { const j = JSON.parse(e); j.mod = Date.now() + 5000; j.data.slots = j.data.slots.slice(0, 3); sessionStorage.setItem('env', JSON.stringify(j)); }, envA);
  await p.reload(); await W(400);
  ok(await p.evaluate(() => D.slots.length) === 3, 'neuere Kopie gewinnt');
  // d) kaputte Kopie: Web-Speicher bleibt
  await p.evaluate(() => sessionStorage.setItem('env', '{kaputt'));
  await p.reload(); await W(400);
  ok(await p.evaluate(() => D.slots.length) === 3, 'kaputte Kopie wird ignoriert');
  // e) kaputter Web-Speicher, gute Kopie
  await p.evaluate(e => { localStorage.setItem('sp.data.v1', '{{{'); sessionStorage.setItem('env', e); }, envA);
  await p.reload(); await W(400);
  ok(await p.evaluate(() => D.slots.length) === 11, 'kaputter Web-Speicher: Kopie rettet');
  ok(await p.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('sp.defekt.'))), 'kaputter Stand aufgehoben');
  // f) alte Kopie (v4 mit erledigten To-Dos) wird migriert
  await p.evaluate(() => {
    localStorage.clear();
    const d = { v: 4, slots: [{ id: 'a', title: 'Arbeit', start: '08:00', end: '16:00', days: [1, 2, 3, 4, 5], color: 'blue', icon: 'briefcase', rt: [] }], ov: {}, chk: {}, todos: [{ id: 't1', title: 'Alt', done: true, doneAt: Date.now() }, { id: 't2', title: 'Offen', done: false }], set: { theme: 'dark', tut: 3 } };
    sessionStorage.setItem('env', JSON.stringify({ app: 'schedule', version: '3.2.0', mod: 5, data: d }));
  });
  await p.reload(); await W(400);
  ok(await p.evaluate(() => D.v === 5 && D.todos.length === 1 && D.stat.n === 1 && D.set.theme === 'dark'), 'alte Kopie migriert');
  ok(await p.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'dunkles Thema aus der Kopie schon beim Start');
  await p.click('#tabs [data-t="set"]'); await W(300);
  const barD = await last('bar');
  ok(barD && barD.theme === 'dark' && barD.light === true && barD.bg === '#000000', 'Statusleiste dunkel gemeldet', JSON.stringify(barD));

  /* ---------- 4. Statusleiste in der Heute-Ansicht ---------- */
  await p.evaluate(e => { localStorage.clear(); sessionStorage.setItem('env', e); }, envA);
  await p.reload(); await W(400);
  await p.evaluate(() => sessionStorage.removeItem('env'));   // ab hier gilt der Web-Speicher (die Uhr wird gleich verstellt)
  await setNow(1, 9, 0); await p.reload(); await W(400);
  await safeArea();
  const barF = await last('bar');
  ok(barF && barF.bg === '#007aff' && barF.light === true, 'Heute: Statusleiste in Blockfarbe, helle Schrift', JSON.stringify(barF));
  await p.screenshot({ path: SH + 'n1-heute.png' });
  // gelber Blocker: dunkle Schrift
  await setNow(1, 19, 0); await p.evaluate(() => tick()); await W(300);
  const barY = await last('bar');
  ok(barY && barY.bg === '#ffcc00' && barY.light === false, 'heller Blocker: dunkle Schrift', JSON.stringify(barY));
  await p.click('#tabs [data-t="week"]'); await W(400);
  const barW = await last('bar');
  ok(barW && barW.bg === '#f2f2f7', 'Woche: normale Statusleiste', JSON.stringify(barW));
  await p.screenshot({ path: SH + 'n2-woche.png' });

  /* ---------- 5. Tippgefühl ---------- */
  await clearMsgs();
  await p.click('#tabs [data-t="prod"]'); await W(300);
  ok((await msgs('haptic')).some(m => m.k === 'sel'), 'Tab-Wechsel mit Haptik');
  await clearMsgs();
  await p.click('#tabs [data-t="prod"]'); await W(300);
  ok((await msgs('haptic')).length === 0, 'derselbe Tab: keine Haptik');
  await p.fill('#newTodo', 'Probe'); await tap('[data-a="addTodo"]');
  await clearMsgs();
  await tap('[data-a="todoDone"]', 700);
  ok((await msgs('haptic')).some(m => m.k === 'ok'), 'Abhaken mit Haptik');
  ok(await p.evaluate(() => D.stat.n) === 1, 'To-Do gezählt');

  /* ---------- 6. Einstellungen in der App ---------- */
  await p.click('#tabs [data-t="set"]'); await W(300);
  let t = await p.locator('#page').innerText();
  ok(/Version 4\.0\.0/.test(t), 'Version in den Einstellungen');
  ok(/Tägliche Sicherungen/i.test(t), 'Zeile Tägliche Sicherungen');
  ok(/Auf meinem iPhone › Schedule › Sicherungen/.test(t), 'Fußzeile nennt den Ordner');
  ok(!/läuft am/.test(t), 'kein Ablauf-Hinweis ohne Ablaufdatum');
  await p.screenshot({ path: SH + 'n3-einstellungen.png' });
  await clearMsgs();
  await tap('[data-a="openBackups"]');
  ok((await msgs('backups')).length === 1, 'Sicherungen öffnen meldet an die App');
  await p.evaluate(() => window.__nativeBackups(false)); await W(200);
  ok(/Dateien-App/.test(await p.locator('#toast').innerText()), 'Hinweis, wenn Dateien nicht aufgeht');
  // Backup sichern geht über die App (Teilen-Menü)
  await clearMsgs();
  await tap('[data-a="export"]');
  const ex = await last('export');
  ok(ex && /^schedule-backup-\d{4}-\d\d-\d\d\.json$/.test(ex.name), 'export mit Dateiname', ex && ex.name);
  const exj = ex && JSON.parse(ex.text);
  ok(exj && exj.app === 'schedule' && exj.version === '4.0.0' && exj.data.slots.length === 11, 'export enthält die Daten');
  await p.evaluate(() => window.__nativeExported(true)); await W(200);
  ok(/Backup gesichert/.test(await p.locator('#toast').innerText()), 'Meldung nach dem Sichern');

  /* ---------- 7. Mitteilungen ohne Server ---------- */
  await tap('[data-a="go"][data-p="push"]', 500);
  t = await p.locator('#page').innerText();
  ok(/ohne Server und ohne Internet/.test(t), 'Mitteilungen: Text ohne Server');
  ok(!/Home-Bildschirm|Push-Server|Server-Adresse|Abgleich/i.test(t), 'kein Server, kein Home-Bildschirm', t.slice(0, 300));
  ok(await p.locator('#purl').count() === 0, 'kein Adressfeld');
  ok(await p.locator('[data-a="expToggle"]').count() === 0, 'kein Ablauf-Schalter ohne Ablaufdatum');
  ok(await p.locator('[data-a="pushTest"]').count() === 0, 'kein Test-Knopf, solange aus');
  // Einschalten: fragt die App um Erlaubnis und schickt den Plan gleich mit
  await clearMsgs();
  await tap('[data-a="pushToggle"]', 200);
  let nf = await last('notify');
  ok(nf && nf.on === 1 && nf.ask === 1 && nf.rid > 0, 'notify mit Frage', JSON.stringify(nf).slice(0, 200));
  ok(nf.plan.length > 0 && nf.plan.length <= 59, 'Plan höchstens 59 Blocker-Erinnerungen', nf.plan.length);
  ok(nf.plan.every((x, i) => i === 0 || x.t >= nf.plan[i - 1].t), 'Plan nach Zeit sortiert');
  const pnow = await p.evaluate(() => Date.now());
  ok(nf.plan.every(x => x.t > pnow && x.id && x.title && typeof x.body === 'string'), 'Plan-Einträge vollständig');
  ok(nf.hint.length > 0, 'Hinweis-Mitteilung, weil mehr als 59 anstehen');
  ok(await p.evaluate(() => D.set.push.on) === 0, 'noch aus, bis die Antwort da ist');
  // Antwort einer anderen Anfrage zählt nicht
  await p.evaluate(r => window.__nativeNotify({ rid: r - 1, granted: true, status: 'authorized', n: 1, until: Date.now() }), nf.rid); await W(100);
  ok(await p.evaluate(() => D.set.push.on) === 0, 'fremde Antwort wird ignoriert');
  await p.evaluate(r => window.__nativeNotify({ rid: r, granted: true, status: 'authorized', n: 60, until: Date.now() + 6 * 864e5 }), nf.rid); await W(300);
  ok(await p.evaluate(() => D.set.push.on) === 1, 'an nach Erlaubnis');
  ok(/Mitteilungen sind an/.test(await p.locator('#toast').innerText()), 'Meldung: an');
  t = await p.locator('#page').innerText();
  ok(/60 Erinnerungen sind geplant/.test(t), 'Anzahl geplanter Erinnerungen', t.slice(-300));
  ok(await p.locator('[data-a="pushTest"]').count() === 1, 'Test-Knopf da');
  await p.screenshot({ path: SH + 'n4-mitteilungen.png' });
  // Nach dem Speichern wird von selbst neu geplant (ohne Frage)
  await clearMsgs(); await W(1500);
  nf = await last('notify');
  ok(nf && nf.on === 1 && nf.ask === 0, 'automatisch neu geplant', JSON.stringify(nf).slice(0, 120));
  // Vorlauf ändern plant neu, Titel mit Vorlauf
  await tap('[data-a="opt"][data-o="lead"]', 300);
  await p.locator('.pop button').nth(2).click(); await W(1600);
  nf = await last('notify');
  ok(nf && /^In 10 Min\.: /.test(nf.plan[0].title), 'Vorlauf im Titel', nf && nf.plan[0].title);
  // Test-Mitteilung
  await clearMsgs();
  await tap('[data-a="pushTest"]', 200);
  const nt = await last('notifyTest');
  ok(nt && nt.title === 'Schedule' && /Erinnerung/.test(nt.body), 'Test-Mitteilung an die App');
  // In iOS ausgeschaltet: Hinweis mit Knopf zu den Einstellungen
  await p.evaluate(() => window.__nativeNotify({ rid: 0, granted: false, status: 'denied', n: 0, until: 0 })); await W(200);
  ok(/in den iPhone-Einstellungen ausgeschaltet/.test(await p.locator('#page').innerText()), 'Hinweis bei entzogener Erlaubnis');
  await clearMsgs();
  await tap('[data-a="openSettings"]', 150);
  ok((await msgs('settings')).length === 1, 'iPhone-Einstellungen öffnen');
  // Ausschalten löscht die geplanten Erinnerungen
  await clearMsgs();
  await tap('[data-a="pushToggle"]', 1500);
  nf = await last('notify');
  ok(await p.evaluate(() => D.set.push.on) === 0, 'aus');
  ok(nf && nf.on === 0, 'notify aus', JSON.stringify(nf));
  // Danach kein Abgleich mehr bei jedem Speichern
  await clearMsgs();
  await p.evaluate(() => save()); await W(1500);
  ok((await msgs('notify')).length === 0, 'aus: kein weiterer Abgleich');
  // Abgelehnt: bleibt aus, Meldung
  await clearMsgs();
  await tap('[data-a="pushToggle"]', 200);
  nf = await last('notify');
  await p.evaluate(r => window.__nativeNotify({ rid: r, granted: false, status: 'denied', n: 0, until: 0 }), nf.rid); await W(300);
  ok(await p.evaluate(() => D.set.push.on) === 0, 'abgelehnt: bleibt aus');
  ok(/nicht erlaubt/.test(await p.locator('#toast').innerText()), 'Meldung: nicht erlaubt');
  ok((await last('notify')).on === 0, 'nach Ablehnung nichts geplant');

  /* ---------- 8. Über Schedule ---------- */
  await tap('[data-a="back"]', 500);
  await tap('[data-a="go"][data-p="about"]', 500);
  t = await p.locator('#page').innerText();
  ok(/iPhone-App/i.test(t) && /Läuft ohne Internet/.test(t), 'Über: Abschnitt iPhone-App');
  ok(!/Push-Server/.test(t), 'Über: kein Push-Server');
  ok(!/Gültig bis/.test(t), 'Über: kein Ablauf ohne Datum');
  await p.evaluate(() => logErr('test', new Error('Probe'))); await p.evaluate(() => render()); await W(200);
  await clearMsgs();
  await tap('[data-a="logCopy"]', 200);
  const cp = await last('copy');
  ok(cp && /Schedule 4\.0\.0/.test(cp.text) && /Probe/.test(cp.text), 'Protokoll kopieren über die App');
  await p.evaluate(() => { localStorage.removeItem('sp.log'); });
  // Neu laden über die App
  await clearMsgs();
  await p.evaluate(() => A.reload()); await W(200);
  ok((await msgs('reload')).length === 1, 'Neu laden meldet an die App');

  /* ---------- 9. Ablauf der App (kostenlose Apple-ID) ---------- */
  await p.evaluate(() => sessionStorage.setItem('info', JSON.stringify({ exp: Date.now() + 5.5 * 864e5, build: '1', lang: 'de-DE' })));
  await p.reload(); await W(500); await safeArea();
  await p.click('#tabs [data-t="set"]'); await W(300);
  ok(!/läuft am/.test(await p.locator('#page').innerText()), 'noch 5 Tage: kein Hinweis');
  await tap('[data-a="go"][data-p="about"]', 500);
  t = await p.locator('#page').innerText();
  ok(/Gültig bis .+ um \d\d:\d\d/.test(t) && /Build 1/.test(t), 'Über: gültig bis', t.slice(0, 400));
  await p.screenshot({ path: SH + 'n5-ueber.png' });
  await tap('[data-a="back"]', 500);
  await tap('[data-a="go"][data-p="push"]', 500);
  ok(await p.locator('[data-a="expToggle"]').count() === 1, 'Ablauf-Schalter da');
  await clearMsgs();
  await tap('[data-a="expToggle"]', 200);
  nf = await last('notify');
  ok(nf && nf.ask === 1 && nf.plan.length === 3 && nf.plan.map(x => x.id).join() === 'exp-48,exp-24,exp-3', 'Ablauf-Erinnerungen 48, 24 und 3 Std. vorher', JSON.stringify(nf && nf.plan.map(x => x.id)));
  ok(/Erneuere sie vorher am Computer/.test(nf.plan[0].body), 'Text der Ablauf-Erinnerung');
  await p.evaluate(r => window.__nativeNotify({ rid: r, granted: true, status: 'authorized', n: 3, until: Date.now() + 5 * 864e5 }), nf.rid); await W(300);
  ok(await p.evaluate(() => D.set.push.exp === 1 && D.set.push.on === 0), 'Ablauf an, Blocker aus');
  await p.screenshot({ path: SH + 'n6-mitteilungen-ablauf.png' });
  await p.click('#tabs [data-t="set"]'); await W(400);
  ok(/Mitteilungen\s*An/.test(await p.locator('#page').innerText()), 'Einstellungen zeigen: An');
  // beide an: Ablauf-Erinnerungen zuerst, zusammen höchstens 59 + Hinweis
  await p.evaluate(() => { D.set.push.on = 1; save(); }); await clearMsgs(); await W(1500);
  nf = await last('notify');
  ok(nf && nf.plan.length === 59 && nf.plan.filter(x => x.id.startsWith('exp-')).length === 3, 'beide: 3 + 56', nf && nf.plan.length);
  // bleibt nach Backup laden erhalten (normSet kennt das Feld)
  ok(await p.evaluate(() => migrate(JSON.parse(JSON.stringify(D))).set.push.exp) === 1, 'push.exp übersteht migrate');
  // weniger als 2 Tage: Hinweis in den Einstellungen und einmal am Tag als Meldung
  await p.evaluate(() => { sessionStorage.setItem('info', JSON.stringify({ exp: Date.now() + 30 * 3600e3 })); localStorage.removeItem('sp.expHint'); });
  await p.reload(); await W(2200);
  ok(/Die App läuft am .+ ab/.test(await p.locator('#toast').innerText()), 'Meldung beim Start, wenn die App bald abläuft');
  await p.click('#tabs [data-t="set"]'); await W(300); await safeArea();
  ok(/Die App läuft am .+ ab\. Erneuere sie vorher am Computer/.test(await p.locator('#page').innerText()), 'Hinweis in den Einstellungen');
  await p.screenshot({ path: SH + 'n7-ablauf-hinweis.png' });
  await p.reload(); await W(2200);
  ok(!(await p.locator('#toast.on').count()), 'Meldung nur einmal am Tag');
  nf = await last('notify');
  ok(nf && nf.plan.filter(x => x.id.startsWith('exp-')).map(x => x.id).join() === 'exp-24,exp-3', 'vergangene Ablauf-Erinnerung entfällt', JSON.stringify(nf && nf.plan.slice(0, 3).map(x => x.id)));

  /* ---------- 10. Zurück aus dem Hintergrund, Tipp auf eine Mitteilung ---------- */
  await clearMsgs();
  await p.evaluate(() => window.__nativeResume()); await W(1700);
  ok((await msgs('notify')).length === 1, 'nach dem Öffnen wird nachgelegt');
  await p.click('#tabs [data-t="week"]'); await W(300);
  await p.evaluate(() => window.__nativeGo('day')); await W(300);
  ok(await p.evaluate(() => ui.tab === 'day' && !ui.dayAll), 'Tipp auf Mitteilung öffnet Heute');
  await p.click('#tabs [data-t="set"]'); await W(300);
  await tap('[data-a="import"]', 100).catch(() => {});
  await p.evaluate(() => todoSheet && null);
  // offenes Blatt: bleibt, wo es ist
  await p.click('#tabs [data-t="prod"]'); await W(300);
  await p.fill('#newTodo', 'Blatt'); await tap('[data-a="addTodo"]');
  await tap('[data-a="openTodo"]', 500);
  await p.evaluate(() => window.__nativeGo('day')); await W(200);
  ok(await p.evaluate(() => ui.tab === 'prod' && stack.length === 1), 'offenes Blatt wird nicht weggerissen');
  await p.evaluate(() => closeSheets()); await W(600);

  /* ---------- 11. Ränder: Dynamic Island oben, Home-Balken unten ---------- */
  await p.click('#tabs [data-t="day"]'); await W(300); await safeArea(); await W(100);
  const geo = await p.evaluate(() => {
    const r = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    return { nav: r('.nav-in'), tabs: r('#tabs'), fk: r('.fk'), h: innerHeight };
  });
  ok(geo.nav && geo.nav.top >= 62, 'Kopfzeile unter der Statusleiste', JSON.stringify(geo.nav));
  ok(geo.fk && geo.fk.top >= 62, 'Heute beginnt unter der Statusleiste', JSON.stringify(geo.fk));
  ok(geo.tabs && geo.h - geo.tabs.bottom >= 14 && geo.h - geo.tabs.bottom <= 34, 'Tab-Leiste über dem Home-Balken', geo.tabs && (geo.h - geo.tabs.bottom));
  await p.evaluate(() => dayMode(true)); await W(500);
  await p.screenshot({ path: SH + 'n8-tag.png' });
  await p.click('#tabs [data-t="week"]'); await W(400);
  await tap('.blk', 600);
  const sh = await p.evaluate(() => { const e = document.querySelector('.sheet'); return e ? e.getBoundingClientRect().top : -1; });
  ok(sh >= 62, 'Blatt bleibt unter der Statusleiste', sh);
  await p.screenshot({ path: SH + 'n9-blatt.png' });
  await p.evaluate(() => closeSheets()); await W(600);
  await p.evaluate(() => tutorial()); await W(500);
  const sk = await p.evaluate(() => document.querySelector('.tut .skip').getBoundingClientRect().top);
  ok(sk >= 62, 'Einführung: Überspringen unter der Statusleiste', sk);
  await p.screenshot({ path: SH + 'n10-einfuehrung.png' });
  await tap('.tut [data-a="done"]', 500);

  /* ---------- 12. Im Browser bleibt alles wie bisher ---------- */
  await p.evaluate(() => { sessionStorage.setItem('web', '1'); });
  await p.reload(); await W(600);
  ok(await p.evaluate(() => NATIVE === false && typeof window.__msgs === 'undefined'), 'Browser: keine Brücke');
  await p.click('#tabs [data-t="set"]'); await W(300);
  t = await p.locator('#page').innerText();
  ok(!/Tägliche Sicherungen/i.test(t) && /zum Beispiel in der Dateien-App/.test(t), 'Browser: Einstellungen wie bisher');
  await tap('[data-a="go"][data-p="push"]', 500);
  ok(await p.locator('#purl').count() === 1, 'Browser: Push-Server-Seite wie bisher');
  ok(await p.evaluate(() => expAt()) === 0, 'Browser: kein Ablauf');

  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  ok(!errs.length, 'keine Fehler in der Konsole');
  console.log('pass', pass, 'fail', fail);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
