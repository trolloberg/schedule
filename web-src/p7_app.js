
/* ================= Mitteilungen (Web Push über den eigenen Server) ================= */
// Der Server kennt nur die Uhrzeiten. Name und Text jeder Erinnerung liegen in IndexedDB auf dem Gerät,
// dort liest sie der Service Worker, wenn das Signal kommt.
const PUSH_KEY = 'sp.push';
function pushStatus(){ try { return JSON.parse(localStorage.getItem(PUSH_KEY) || '{}') || {}; } catch (e) { return {}; } }
function setPushStatus(o){ try { localStorage.setItem(PUSH_KEY, JSON.stringify({ ...pushStatus(), ...o })); } catch (e) {} }
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const u8b64u = a => btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function idb(){ return new Promise((res, rej) => { const r = indexedDB.open('schedule', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbSet(k, v){ const db = await idb(); try { await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } finally { db.close(); } }
// Erinnerungen der nächsten Wochen (Zeitpunkt, Titel, Text)
function notifyPlan(days = 28){
  const out = [], now = Date.now(), lead = D.set.push.lead || 0, k0 = today();
  for (let i = 0; i < days; i++){
    const k = addD(k0, i), d = pd(k);
    for (const o of occ(k)){
      if (o.skipped) continue;
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, tmin(o.start) - lead).getTime();
      if (t <= now + 30000) continue;
      const open = todoItems(o).filter(x => !x.done).length;
      out.push({ t, tag: `${k}-${o.id}`,
        title: lead ? L(`In ${lead} Min.: ${o.title}`, `In ${lead} min: ${o.title}`) : o.title,
        body: [fR(o.start, o.end), open ? (open === 1 ? '1 To-Do' : `${open} To-Dos`) : '', o.desc ? o.desc.split('\n')[0].slice(0, 90) : ''].filter(Boolean).join(' · ') });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
let pushT = null;
function schedulePush(){
  if (NATIVE){ const p = D.set.push; if (!p.on && !p.exp && !nOn) return; clearTimeout(pushT); pushT = setTimeout(() => safe('notify', () => nativeSync()), 1200); return; }
  if (!D.set.push.on) return; clearTimeout(pushT); pushT = setTimeout(() => pushSync().catch(() => {}), 2500);
}
/* ---------- iPhone-App: Erinnerungen direkt vom iPhone (lokale Mitteilungen, ohne Server und ohne Internet) ---------- */
// iOS merkt sich höchstens 64 geplante Mitteilungen. Schedule plant deshalb die nächsten und legt bei jedem Öffnen nach.
const N_MAX = 60;
let nOn = true, nRid = 0, nAsk = null;   // nOn: In der App könnten noch Erinnerungen geplant sein
// Ablauf der App (kostenlose Apple-ID: 7 Tage nach dem Laden aufs iPhone). 0 = unbekannt oder läuft nicht ab.
const expAt = () => NATIVE && +NINFO.exp > 0 ? +NINFO.exp : 0;
const expWhen = () => { const d = new Date(expAt()); return L(`${fD(dkey(d), { wd: 'long' })} um ${fT(d.getHours() * 60 + d.getMinutes())}`, `${fD(dkey(d), { wd: 'long' })} at ${fT(d.getHours() * 60 + d.getMinutes())}`); };
function expPlan(){
  const e = expAt(), now = Date.now(), out = [];
  if (!e) return out;
  for (const h of [48, 24, 3]){
    const t = e - h * 3600e3; if (t <= now + 30000) continue;
    out.push({ t, tag: 'exp-' + h, title: L('Schedule läuft bald ab', 'Schedule expires soon'),
      body: L(`Am ${expWhen()} läuft die App ab. Erneuere sie vorher am Computer. Deine Daten bleiben erhalten.`, `The app expires on ${expWhen()}. Renew it on your computer before then. Your data stays.`) });
  }
  return out;
}
// Plan an die App geben. ask = 'on' oder 'exp': vorher um Erlaubnis fragen (nur direkt nach einem Tipp auf den Schalter).
function nativeSync(ask){
  const p = D.set.push, on = !!(p.on || p.exp || ask);
  nOn = on;
  if (!on){ post('notify', { on: 0, rid: ++nRid }); return nRid; }
  const ex = p.exp || ask === 'exp' ? expPlan() : [], bl = p.on || ask === 'on' ? notifyPlan(28) : [];
  const room = N_MAX - ex.length - 1, cut = bl.length > room;
  post('notify', { on: 1, ask: ask ? 1 : 0, rid: ++nRid,
    plan: [...ex, ...bl.slice(0, room)].map(x => ({ t: x.t, id: x.tag, title: x.title, body: x.body })),
    hint: cut ? L('Öffne Schedule kurz, damit weitere Erinnerungen geplant werden.', 'Open Schedule briefly so more reminders can be planned.') : '' });
  return nRid;
}
function nativeAsk(kind){
  return new Promise(res => {
    const rid = nativeSync(kind), t = setTimeout(() => fin(null), 120000);
    const fin = r => { if (nAsk !== h) return; nAsk = null; clearTimeout(t); res(r); };
    const h = nAsk = { rid, fin };
  });
}
// Antwort der App: erlaubt?, wie viele Erinnerungen geplant sind und bis wann
window.__nativeNotify = r => {
  if (!r || typeof r !== 'object') return;
  setPushStatus({ last: Date.now(), n: Math.max(0, +r.n || 0), until: +r.until || 0, st: String(r.status || ''), err: '' });
  if (nAsk && +r.rid === nAsk.rid) nAsk.fin(r);
  if (ui.tab === 'set' && ui.sub[ui.sub.length - 1] === 'push' && !stack.length) safe('notify', render);
};
async function nativeToggle(f){
  const p = D.set.push;
  if (p[f]){ p[f] = 0; save(); render(); return; }   // save() gleicht die Erinnerungen ab
  if (nAsk) return;
  const r = await nativeAsk(f);
  if (r && r.granted){
    p[f] = 1; save(); render(); haptic('ok');
    toast(f === 'on' ? L('Mitteilungen sind an', 'Notifications are on') : L('Du wirst vor dem Ablauf erinnert', 'You will be reminded before it expires'));
  } else {
    nativeSync(); render();
    toast(L('Mitteilungen sind nicht erlaubt. Erlaube sie in den iPhone-Einstellungen unter Mitteilungen.', 'Notifications are not allowed. Allow them in the iPhone Settings under Notifications.'));
  }
}
A.expToggle = () => { if (NATIVE) nativeToggle('exp'); };
A.openSettings = () => { post('settings'); };
A.openBackups = () => { if (!post('backups')) window.__nativeBackups(false); };
window.__nativeBackups = ok => { if (!ok) toast(L('Öffne die Dateien-App: Auf meinem iPhone › Schedule › Sicherungen', 'Open the Files app: On My iPhone › Schedule › Sicherungen')); };
window.__nativeExported = ok => { if (ok) toast(L('Backup gesichert', 'Backup saved')); };
// Einmal am Tag hinweisen, wenn die App in den nächsten zwei Tagen abläuft
function expHint(){
  const e = expAt(); if (!e) return;
  const left = e - Date.now(); if (left <= 0 || left > 2 * 864e5) return;
  try { if (localStorage.getItem('sp.expHint') === today()) return; localStorage.setItem('sp.expHint', today()); } catch (_) {}
  toast(L(`Die App läuft am ${expWhen()} ab. Erneuere sie am Computer.`, `The app expires on ${expWhen()}. Renew it on your computer.`));
}
async function pushSync(){
  const p = D.set.push;
  if (NATIVE){ nativeSync(); return true; }
  if (!p.on || !p.url || !pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (!sub) throw new Error(L('Mitteilungen sind auf diesem Gerät nicht mehr erlaubt. Schalte sie aus und wieder ein.', 'Notifications are no longer allowed on this device. Turn them off and on again.'));
    const plan = notifyPlan(28);
    await idbSet('plan', plan);
    await idbSet('fallback', { title: APP, body: L('Ein neuer Blocker beginnt.', 'A new block is starting.') });
    const times = [...new Set(plan.map(x => x.t))].slice(0, 500);
    const r = await fetch(p.url + '/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON(), times }) });
    if (!r.ok) throw new Error(L(`Der Server meldet Fehler ${r.status}.`, `The server reports error ${r.status}.`));
    setPushStatus({ last: Date.now(), n: times.length, err: '' });
    return true;
  } catch (e) {
    const m = e && e.message || '';
    setPushStatus({ err: m && !/fetch|network|load failed|NetworkError/i.test(m) ? m : L('Server nicht erreichbar. Stimmt die Adresse, und bist du online?', 'Server not reachable. Is the address right, and are you online?') });
    return false;
  } finally { if (ui.tab === 'set' && ui.sub[ui.sub.length - 1] === 'push') render(); }
}
function readUrl(){
  const el = $('#purl');
  let v = (el ? el.value : D.set.push.url).trim();
  if (!v) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.search || u.hash || u.username) return null;
    return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch (e) { return null; }
}
A.pushUrl = () => {
  const v = readUrl();
  if (v === null){ toast(L('Das ist keine gültige https-Adresse.', 'That is not a valid https address.')); return; }
  if (v === D.set.push.url) return;
  D.set.push.url = v; save(); render();
  if (v) toast(L('Adresse gespeichert', 'Address saved'));
};
function sameKey(sub, key){ try { const k = sub.options && sub.options.applicationServerKey; return !k || u8b64u(k) === key; } catch (e) { return true; } }
A.pushToggle = async () => {
  const p = D.set.push;
  if (NATIVE){ await nativeToggle('on'); return; }
  if (p.on){
    p.on = 0; save(); render();
    try {
      const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
      if (sub){ if (p.url) fetch(p.url + '/off', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe(); }
    } catch (e) {}
    setPushStatus({ last: 0, n: 0, err: '' }); render();
    return;
  }
  if (!pushSupported() || !isStandalone()){ toast(L('Öffne Schedule über den Home-Bildschirm, dann klappt es.', 'Open Schedule from the Home Screen, then it works.')); return; }
  const url = readUrl();
  if (!url){ toast(L('Trag zuerst die Adresse deines Push-Servers ein.', 'Enter the address of your push server first.')); const el = $('#purl'); if (el) el.focus(); return; }
  // iOS: Die Erlaubnis muss direkt beim Tippen angefragt werden, deshalb kommt sie zuerst
  let perm = 'default';
  try { perm = await Notification.requestPermission(); } catch (e) {}
  if (perm !== 'granted'){ toast(L('Mitteilungen sind nicht erlaubt. Ändern kannst du das in den iPhone-Einstellungen unter Mitteilungen.', 'Notifications are not allowed. You can change this in the iPhone Settings under Notifications.')); return; }
  p.url = url;
  try {
    const kr = await fetch(url + '/key'); if (!kr.ok) throw new Error('key');
    const key = (await kr.text()).trim();
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, key)){ await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
    p.on = 1; save();
    const ok = await pushSync();
    render();
    toast(ok ? L('Mitteilungen sind an', 'Notifications are on') : L('Eingeschaltet, aber der Abgleich hat nicht geklappt.', 'Turned on, but syncing did not work.'));
  } catch (e) {
    save(); setPushStatus({ err: L('Server nicht erreichbar. Stimmt die Adresse?', 'Server not reachable. Is the address right?') }); render();
  }
};
A.pushTest = async () => {
  if (NATIVE){
    post('notifyTest', { title: APP, body: L('So sieht deine Erinnerung aus, wenn ein Blocker beginnt.', 'This is how your reminder looks when a block starts.') });
    toast(L('Die Test-Mitteilung kommt in 5 Sekunden.', 'The test notification arrives in 5 seconds.'));
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (!sub) throw new Error('sub');
    await idbSet('test', { at: Date.now(), title: APP, body: L('So sieht deine Erinnerung aus, wenn ein Blocker beginnt.', 'This is how your reminder looks when a block starts.') });
    const r = await fetch(D.set.push.url + '/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    if (!r.ok) throw new Error(String(r.status));
    toast(L('Test gesendet, die Mitteilung kommt gleich.', 'Test sent, the notification arrives shortly.'));
  } catch (e) { toast(L('Der Test hat nicht geklappt. Tippe zuerst auf „Jetzt abgleichen“.', 'The test did not work. Tap “Sync now” first.')); }
};
A.pushNow = async () => { const ok = await pushSync(); toast(ok ? L('Abgeglichen', 'Synced') : L('Abgleich hat nicht geklappt', 'Sync did not work')); };

/* ================= Einführung ================= */
function tutorial(){
  if ($('.tut')) return;
  const first = !D.slots.length;
  const deco = (a, b, c, d) => `<span class="fl ${cc(a)}" style="left:4px;top:26px;width:34px;height:54px"></span><span class="fl ${cc(b)}" style="right:2px;top:12px;width:42px;height:30px"></span><span class="fl ${cc(c)}" style="left:16px;bottom:8px;width:46px;height:32px"></span><span class="fl ${cc(d)}" style="right:12px;bottom:26px;width:30px;height:58px"></span>`;
  const P = [
    { art: `${deco('blue', 'orange', 'green', 'purple')}<div class="orb"><img src="apple-touch-icon.png" alt=""></div>`, h: L(`Willkommen bei ${APP}`, `Welcome to ${APP}`), p: L('Deine Woche in Blöcken: einmal planen, jeden Tag den Überblick haben. Alles bleibt auf deinem iPhone.', 'Your week in blocks: plan once, stay on top of every day. Everything stays on your iPhone.') },
    { art: `${deco('blue', 'teal', 'orange', 'pink')}<div class="orb ${cc('indigo')}">${I('calendar')}</div>`, h: L('Plane deine ideale Woche', 'Plan your ideal week'), p: L('In der Master-Woche legst du einmal fest, wann Arbeit, Sport oder Lernen dran sind. Sie wiederholt sich jede Woche von selbst.', 'In the master week you set once when work, sport or study happen. It repeats every week by itself.') },
    { art: `${deco('green', 'yellow', 'indigo', 'red')}<div class="orb ${cc('blue')}">${I('tabToday')}</div>`, h: L('Heute auf einen Blick', 'Today at a glance'), p: L('Heute zeigt groß, was gerade läuft und wie lange noch. Deine To-Dos hakst du direkt dort ab. Doppelt tippen zeigt den ganzen Tag.', 'Today shows what is on now and how long it lasts. You check off your to-dos right there. Double-tap shows the whole day.') },
    { art: `${deco('purple', 'blue', 'mint', 'coral')}<div class="orb ${cc('orange')}">${I('move')}</div>`, h: L('Gedrückt halten zum Anpassen', 'Press and hold to adjust'), p: L('Halte in der Woche einen Blocker gedrückt. Dann verschiebst, verlängerst, teilst, duplizierst oder löschst du ihn, nur für diese Woche.', 'Press and hold a block in the week. Then move, extend, split, duplicate or delete it, just for this week.') },
    { art: `${deco('orange', 'green', 'blue', 'yellow')}<div class="orb ${cc('red')}">${I('bell')}</div>`, h: L('Pünktlich erinnert', 'Reminded on time'), p: L('Auf Wunsch meldet sich dein iPhone, wenn ein neuer Blocker beginnt. Das schaltest du unter Einstellungen → Mitteilungen ein.', 'If you like, your iPhone lets you know when a new block starts. Turn it on in Settings → Notifications.') }
  ];
  let i = 0;
  const T = document.createElement('div');
  T.className = 'tut'; T.setAttribute('role', 'dialog'); T.setAttribute('aria-modal', 'true'); T.setAttribute('aria-label', L('Einführung', 'Introduction'));
  T.innerHTML = `<div class="amb"></div><button class="gpill sm glass skip" data-a="done">${L('Überspringen', 'Skip')}</button><div class="tw"><div class="tr">${P.map(p => `<section class="tp"><div class="art">${p.art}</div><h1>${p.h}</h1><p>${p.p}</p></section>`).join('')}</div></div><div class="tf"><div class="dots">${P.map(() => '<i></i>').join('')}</div><div class="tb"></div></div>`;
  const tr = $('.tr', T), tb = $('.tb', T), sk = $('.skip', T);
  const go = n => {
    i = clamp(n, 0, P.length - 1);
    tr.style.transform = `translateX(${-i * 100}%)`;
    T.querySelectorAll('.dots i').forEach((d, j) => d.classList.toggle('on', j === i));
    T.querySelectorAll('.tp').forEach((p, j) => p.setAttribute('aria-hidden', String(j !== i)));
    sk.style.visibility = i === P.length - 1 ? 'hidden' : '';
    tb.innerHTML = i < P.length - 1 ? `<button class="abtn tint" data-a="next">${L('Weiter', 'Continue')}</button>`
      : first ? `<button class="abtn tint" data-a="setup">${L('Master-Woche einrichten', 'Set up master week')}</button><button class="abtn soft" data-a="sample">${L('Mit Beispielwoche starten', 'Start with a sample week')}</button>`
      : `<button class="abtn tint" data-a="done">${L('Los geht’s', 'Let’s go')}</button>`;
  };
  const close = then => { D.set.tut = 3; save(); T.classList.remove('in'); setTimeout(() => { T.remove(); layerGone(); }, 320); if (then) then(); };
  T._on = { next: () => go(i + 1), done: () => close(), setup: () => close(A.startSetup), sample: () => close(loadSample) };
  let x0 = null, y0 = 0;
  T.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  T.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(i + (dx < 0 ? 1 : -1)); }, { passive: true });
  document.body.appendChild(T);
  go(0);
  T.getBoundingClientRect();
  requestAnimationFrame(() => T.classList.add('in'));
}

/* ================= Backup ================= */
async function exportData(){
  const json = JSON.stringify({ app: 'schedule', version: APP_VERSION, exported: new Date().toISOString(), data: D });
  const name = `schedule-backup-${today()}.json`;
  if (NATIVE && post('export', { name, text: json })) return;
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })){ await navigator.share({ files: [file], title: L('Schedule-Backup', 'Schedule backup') }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(L('Backup gesichert', 'Backup saved'));
}
$('#imp').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  let j; try { j = JSON.parse(await file.text()); } catch (_) { toast(L('Die Datei ist kein gültiges Backup.', 'This file is not a valid backup.')); return; }
  const data = j && j.data ? j.data : j;
  if (!data || !(Array.isArray(data.slots) || Array.isArray(data.plans))){ toast(L('Die Datei ist kein Schedule-Backup.', 'This file is not a Schedule backup.')); return; }
  if (!await ask({ title: L('Backup laden?', 'Load backup?'), msg: L('Deine aktuellen Daten auf diesem Gerät werden durch das Backup ersetzt.', 'Your current data on this device is replaced by the backup.'), ok: L('Laden', 'Load') })) return;
  replaceData(migrate(data)); applyLang(); applyTheme(); ui.week = wkStart(today()); refreshAll(); toast(L('Backup geladen', 'Backup loaded'));
});

function loadSample(){
  if (D.slots.length){ toast(L('Deine Master-Woche ist nicht leer.', 'Your master week is not empty.')); return; }
  const S = (de, en, start, end, days, color, icon, desc = ['', ''], rt = []) => ({ id: uid(), title: L(de, en), desc: L(desc[0], desc[1]), start, end, days, color, icon, rt: rt.map(([a, b]) => ({ id: uid(), title: L(a, b) })) });
  D.slots = [
    S('Morgenroutine', 'Morning routine', '06:30', '07:00', [1, 2, 3, 4, 5], 'orange', 'sunny', ['Aufstehen, Wasser trinken, kurz den Tag planen.', 'Get up, drink water, plan the day.'], [['Bett machen', 'Make the bed'], ['Tag planen', 'Plan the day']]),
    S('Arbeit', 'Work', '07:30', '16:00', [1, 2, 3, 4, 5], 'blue', 'briefcase'),
    S('Heimweg', 'Commute home', '16:00', '16:30', [1, 2, 3, 4, 5], 'slate', 'train'),
    S('Sport', 'Workout', '17:00', '18:30', [1, 3, 5], 'green', 'barbell', ['Gym: Kraft, danach 10 Minuten Mobility.', 'Gym: strength, then 10 minutes of mobility.'], [['Dehnen', 'Stretch'], ['Protein-Shake', 'Protein shake']]),
    S('Abendessen', 'Dinner', '18:45', '19:30', [1, 2, 3, 4, 5], 'yellow', 'restaurant'),
    S('Lernen', 'Study', '19:30', '21:00', [2, 4], 'indigo', 'book'),
    S('Side-Hustle', 'Side hustle', '19:30', '21:00', [1, 3], 'purple', 'laptop', ['An der eigenen Idee arbeiten.', 'Work on your own idea.']),
    S('Abendroutine', 'Evening routine', '22:00', '22:30', [1, 2, 3, 4, 5, 6, 7], 'teal', 'moon', ['', ''], [['Handy weglegen', 'Put the phone away']]),
    S('Wocheneinkauf', 'Groceries', '10:00', '11:00', [6], 'mint', 'cart'),
    S('Fußball', 'Football', '14:00', '17:00', [6], 'red', 'football'),
    S('Wochenplanung', 'Weekly planning', '18:00', '18:30', [7], 'graphite', 'calendar', ['Rückblick auf die Woche, dann die nächste planen.', 'Look back on the week, then plan the next one.'])
  ];
  save(); refreshAll(); toast(L('Beispielwoche geladen. Anpassen unter Einstellungen.', 'Sample week loaded. Adjust it in Settings.'));
}

/* ================= Ereignisse ================= */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const host = el.closest('.layer, .tut');
  const h = host ? host._on : (document.querySelector('.layer') && !el.closest('#toast') ? null : A);
  const fn = h && h[el.dataset.a];
  if (fn){ e.preventDefault(); if (NATIVE) tapHaptic(el); safe('tap ' + el.dataset.a, () => fn(el, e)); }
});
// iPhone-App: kurzes Tippgefühl wie bei iOS-Schaltern und beim Abhaken
const HAP = { tab: 'sel', tlTodo: 'ok', todoDone: 'ok', tg: 'ok', theme: 'sel', weekPrev: 'sel', weekNext: 'sel', weekNow: 'sel', dayAll: 'light', dayFocus: 'light', asPick: 'ok', wipe: 'warn' };
function tapHaptic(el){
  const k = el.classList.contains('sw') ? 'light' : HAP[el.dataset.a];
  if (k && !(el.dataset.a === 'tab' && el.dataset.t === ui.tab)) haptic(k);
}
// Ein Fehler in einer Aktion soll die Oberfläche nicht halb fertig zurücklassen
function safe(where, fn){
  try { return fn(); }
  catch (err){ logErr(where, err); try { if (G) cancelGesture(); render(); } catch (_) {} }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter){
    e.preventDefault();
    const host = e.target.closest('.layer, .tut'), h = host ? host._on : A, fn = h && h[e.target.dataset.enter];
    if (fn) safe('enter ' + e.target.dataset.enter, () => fn(e.target, e));
  } else if (e.key === 'Escape'){
    if (stack.length) stack[stack.length - 1].cancel();
    else if (ED.on) edExit();
  }
});
document.addEventListener('change', e => { if (e.target.id === 'purl') A.pushUrl(); });
/* ---------- Wochen wechseln: Die Woche folgt dem Finger, dann ein weicher Glas-Übergang ---------- */
// Nur transform und opacity werden bewegt. Alles endet ohne Inline-Stile, und ein Wächter räumt auf,
// falls iOS eine Animation nicht zu Ende spielt. So bleibt nie eine leere oder verschwommene Ansicht stehen.
const veilEl = $('#veil');
let sw = null, WT = null;
const reduceMo = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const canAnim = () => !!page.animate && !reduceMo() && !document.hidden;
function pageClear(){ page.style.transform = ''; page.style.opacity = ''; page.classList.remove('wsw'); }
function weekGo(n, to, after){
  if (WT) wtEnd();
  const next = to || addD(ui.week, 7 * n), h0 = WK ? WK.H0 : null, y0 = scroller.scrollTop;
  const swap = () => {
    ui.week = next; ui.anim = ''; render();
    // dieselbe Uhrzeit oben halten, auch wenn die neue Woche früher oder später beginnt
    if (after) after(); else if (h0 !== null && WK) scroller.scrollTop = Math.max(0, y0 - (WK.H0 - h0) * 60 * PPM);
    onScroll();
  };
  if (!canAnim() || ui.tab !== 'week' || ED.on){ pageClear(); swap(); return; }
  const x0 = page.style.transform || 'translate3d(0,0,0)', o0 = page.style.opacity || '1', dist = Math.min(innerWidth * .2, 80);
  page.style.transform = ''; page.style.opacity = '';
  page.classList.add('wsw');
  const T = WT = { swap, swapped: false, out: null, inn: null, dog: setTimeout(wtEnd, 1500) };
  veilEl.classList.add('on');
  T.veil = veilEl.animate([{ opacity: 0 }, { opacity: 1, offset: .32 }, { opacity: 0 }], { duration: 470, easing: 'ease-in-out' });
  T.out = page.animate([{ transform: x0, opacity: o0 }, { transform: `translate3d(${-n * dist}px,0,0)`, opacity: 0 }], { duration: 150, easing: 'cubic-bezier(.4,0,.9,.6)', fill: 'forwards' });
  T.out.onfinish = () => {
    if (WT !== T) return;
    T.swapped = true; safe('weekGo', swap);
    page.classList.add('wsw');
    T.inn = page.animate([{ transform: `translate3d(${n * dist}px,0,0)`, opacity: 0 }, { transform: 'translate3d(0,0,0)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.9,.25,1)' });
    T.out.cancel();
    T.inn.onfinish = () => { if (WT === T) wtEnd(); };
  };
}
function wtEnd(){
  const T = WT; if (!T) return; WT = null;
  clearTimeout(T.dog);
  if (!T.swapped){ T.swapped = true; safe('weekGo', T.swap); }
  for (const a of [T.out, T.inn, T.veil]) try { if (a) a.cancel(); } catch (e) {}
  veilEl.classList.remove('on'); pageClear();
  warmWeeks();
}
// Nachbarwochen schon im Leerlauf berechnen, damit der nächste Wechsel nichts mehr rechnen muss
function warmWeeks(){ const f = () => { if (ui.tab === 'week') for (const k of [...weekKeys(addD(ui.week, -7)), ...weekKeys(addD(ui.week, 7))]) occ(k); }; (window.requestIdleCallback || (g => setTimeout(g, 250)))(f); }
function swBack(){
  const tr = page.style.transform, op = page.style.opacity || '1';
  pageClear();
  if (tr && canAnim()) page.animate([{ transform: tr, opacity: op }, { transform: 'translate3d(0,0,0)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)' });
}
function swPaint(){
  const s = sw; if (!s) return; s.raf = 0;
  const x = s.dx * .5;   // die Woche folgt gedämpft
  page.style.transform = `translate3d(${x}px,0,0)`; page.style.opacity = String(1 - Math.min(Math.abs(x) / 300, .4));
}
scroller.addEventListener('touchstart', e => {
  const el = e.target.closest('[data-swipe]');
  if (!el || ED.on || WT || e.touches.length > 1){ sw = null; return; }
  const t = e.touches[0]; sw = { x: t.clientX, y: t.clientY, at: Date.now(), lock: 0, dx: 0, raf: 0 };
}, { passive: true });
scroller.addEventListener('touchmove', e => {
  const s = sw; if (!s) return;
  if (e.touches.length > 1 || ED.on || (G && G.kind !== 'press')){ sw = null; if (s.raf) cancelAnimationFrame(s.raf); if (s.lock === 1) swBack(); return; }
  const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
  if (!s.lock){
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) <= Math.abs(dy) * 1.2){ sw = null; return; }   // senkrecht: normal scrollen
    s.lock = 1; page.classList.add('wsw');
  }
  s.dx = dx;
  if (!s.raf) s.raf = requestAnimationFrame(swPaint);
}, { passive: true });
scroller.addEventListener('touchend', e => {
  const s = sw; sw = null; if (!s || s.lock !== 1) return;
  if (s.raf) cancelAnimationFrame(s.raf);
  const t = e.changedTouches[0], dx = t ? t.clientX - s.x : s.dx, v = Math.abs(dx) / Math.max(1, Date.now() - s.at);
  if (!ED.on && !G && (Math.abs(dx) > 70 || (Math.abs(dx) > 30 && v > .35)))weekGo(dx < 0 ? 1 : -1);
  else swBack();
}, { passive: true });
scroller.addEventListener('touchcancel', () => { const s = sw; sw = null; if (s && s.lock === 1){ if (s.raf) cancelAnimationFrame(s.raf); swBack(); } }, { passive: true });
document.addEventListener('touchstart', () => {}, { passive: true });
// Heute: doppelt tippen (irgendwo außer auf Knöpfe) zeigt den ganzen Tag
let tap0 = null, tapLast = null;
scroller.addEventListener('pointerdown', e => { tap0 = e.isPrimary ? { x: e.clientX, y: e.clientY, t: Date.now() } : null; }, { passive: true });
scroller.addEventListener('pointerup', e => {
  const a = tap0; tap0 = null;
  if (!a || ui.tab !== 'day' || ui.dayAll || !$('.fcs', page) || stack.length) { tapLast = null; return; }
  if (e.target.closest('button, input, textarea, a, [data-a]')){ tapLast = null; return; }
  const now = Date.now();
  if (now - a.t > 350 || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 12){ tapLast = null; return; }
  if (tapLast && now - tapLast.t < 380 && Math.hypot(e.clientX - tapLast.x, e.clientY - tapLast.y) < 40){ tapLast = null; haptic('light'); safe('dbl', () => dayMode(true)); return; }
  tapLast = { x: e.clientX, y: e.clientY, t: now };
}, { passive: true });
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) window.scrollTo(0, 0); }, 60));
window.addEventListener('storage', e => { if (e.key === KEY){ D = load(); OCC.clear(); applyLang(); applyTheme(); refreshAll(); } });

// Uhrzeit-Updates: nur Geändertes austauschen und nie, während jemand scrollt oder den Finger auf dem Bildschirm hat
let tickT = 0;
function tick(){
  clearTimeout(tickT);
  if (document.hidden) return;
  if (G){ if (Date.now() - (G.t || 0) > 30000 && !busy()) cancelGesture(); else return; }   // hängende Geste lösen
  if (busy()){ tickT = setTimeout(tick, 1500); return; }
  const t = today();
  if (t !== ui.lastToday){ if (ui.week === wkStart(ui.lastToday)) ui.week = wkStart(t); ui.lastToday = t; OCC.clear(); if (purgeOld()) save(); refreshAll(); schedulePush(); return; }
  if (ui.tab === 'day' || ui.tab === 'week') safe('tick', softRender);
}
setInterval(tick, 30000);
// Zurück aus dem Hintergrund: erst warten, bis iOS die App wieder zeichnet, dann aufräumen und neu aufbauen
let resumeT = 0;
function onResume(){
  clearTimeout(resumeT);
  resumeT = setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (document.hidden) return;
    safe('resume', () => { unstick(); tick(); if (!busy() && !G) heal(); });
  })), 150);
}
// Zustände, die nach einer Unterbrechung hängen bleiben könnten
function unstick(){
  if (G) cancelGesture();
  if (WT) wtEnd();
  if (sw){ sw = null; }
  pageClear(); veilEl.classList.remove('on');
  lockScroll(false); stopAuto();
  scroller.style.overflowY = '';
  page.classList.remove('push', 'pop', 'heal'); page.style.display = '';
  for (const l of document.querySelectorAll('.layer.out')) l.remove();
  const tu = $('.tut'); if (tu && !tu.classList.contains('in')) tu.remove();
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  if (scroller.scrollTop > max) scroller.scrollTop = max;
  if (!page.firstElementChild) render();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden){ if (G) cancelGesture(); return; }
  onResume();
  if (NATIVE){ schedulePush(); expHint(); return; }
  const st = pushStatus();
  if (D.set.push.on && (!st.last || Date.now() - st.last > 6 * 3600e3)) pushSync().catch(() => {});
});
// iPhone-App: Die App meldet sich, wenn sie wieder vorn ist oder eine Mitteilung angetippt wurde
window.__nativeResume = () => { onResume(); schedulePush(); expHint(); };
window.__nativeGo = t => {
  if (t !== 'day' || stack.length || ED.on || ui.assign || $('.tut') || document.querySelector('.layer')) return;
  safe('go', () => { ui.dayAll = false; if (ui.tab !== 'day') switchTab('day'); else { scroller.scrollTop = 0; render(); } });
};
window.addEventListener('pageshow', onResume);
window.addEventListener('focus', onResume);

/* ================= Start ================= */
applyLang(); applyTheme();
ui.week = wkStart(today());
try { const raw = localStorage.getItem(KEY); if ((raw && JSON.parse(raw).v !== DATA_V) | purgeOld() | RESTORED) save(); } catch (e) { if (RESTORED) save(); }
render();
if ((D.set.tut || 0) < 3) tutorial();
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
if (!NATIVE && 'serviceWorker' in navigator && location.protocol !== 'file:'){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  const hadSW = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW && !reloaded && !stack.length && !ED.on && !$('.tut')){ reloaded = true; location.reload(); } });
}
setTimeout(() => { if (NATIVE){ nativeSync(); expHint(); } else if (D.set.push.on) pushSync().catch(() => {}); }, NATIVE ? 1500 : 3000);
// iPhone-App: Bescheid geben, dass die Oberfläche steht
post('ready', { v: APP_VERSION });
</script>
</body>
</html>
