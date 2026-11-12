const APP = 'Schedule', APP_VERSION = '4.0.0';
const KEY = 'sp.data.v1', DATA_V = 5;   // Speicher-Schlüssel bleibt, damit alte Daten gefunden werden
/*@@ICONS@@*/
IC.redo = `<g transform="matrix(-1 0 0 1 512 0)">${IC.undo}</g>`;   // Wiederholen = gespiegeltes Rückgängig
IC.expand = '<path d="M432 320v112H320M421.8 421.8L304 304M80 192V80h112M90.2 90.2L208 208M320 80h112v112M421.8 90.2L304 208M192 432H80V320M90.2 421.8L208 304" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/>';
IC.more = '<circle cx="256" cy="256" r="42"/><circle cx="416" cy="256" r="42"/><circle cx="96" cy="256" r="42"/>';
IC.tabProd = '<path d="M104 496H72a24 24 0 01-24-24V328a24 24 0 0124-24h32a24 24 0 0124 24v144a24 24 0 01-24 24zM328 496h-32a24 24 0 01-24-24V232a24 24 0 0124-24h32a24 24 0 0124 24v240a24 24 0 01-24 24zM440 496h-32a24 24 0 01-24-24V120a24 24 0 0124-24h32a24 24 0 0124 24v352a24 24 0 01-24 24zM216 496h-32a24 24 0 01-24-24V40a24 24 0 0124-24h32a24 24 0 0124 24v432a24 24 0 01-24 24z"/>';

/* ================= Hilfen ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const str = s => typeof s === 'string' && s.trim() ? s : '';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ================= iPhone-App ================= */
// In der iPhone-App läuft dieselbe Oberfläche in einer WKWebView. Was eine Webseite nicht kann (Erinnerungen ohne
// Server, Sichern in die Dateien-App, Vibration, eine zweite Kopie der Daten), erledigt die App über diese Brücke.
// Im Browser ist NATIVE false, dann bleibt alles wie bisher.
const NB = (() => { try { const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.schedule; return h && typeof h.postMessage === 'function' ? h : null; } catch (e) { return null; } })();
const NATIVE = !!NB;
const NINFO = (() => { try { const b = window.__nativeBoot; return (b && typeof b.info === 'object' && b.info) || {}; } catch (e) { return {}; } })();
function post(t, o){ if (!NB) return false; try { NB.postMessage({ t, ...(o || {}) }); return true; } catch (e) { return false; } }
const haptic = k => { if (NB) post('haptic', { k }); };

/* ================= Sprache ================= */
let LANG = 'de';
const L = (de, en) => LANG === 'en' ? en : de;
const sysLocale = () => String((NATIVE && NINFO.lang) || navigator.language || 'de');
const sysLang = () => sysLocale().toLowerCase().startsWith('de') ? 'de' : 'en';

/* ================= Symbole ================= */
const ALL_ICONS = new Set(ICAT.flatMap(c => c[3]));
const I = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 512 512" aria-hidden="true">${IC[n] || ''}</svg>`;
const CHEV = I('chevR', 'chev');
// Schlüsselwörter für den automatischen Symbol-Vorschlag (Reihenfolge = Vorrang)
const ICON_KW = [
  ['football', 'fußball|fussball|soccer|kicken|spieltag|tus |verein'], ['basketball', 'basketball'], ['tennisball', 'tennis|padel|squash|badminton'],
  ['american-football', 'american football|footballtraining'], ['bicycle', 'fahrrad|radfahren|radtour|rennrad|bike|cycling|spinning'],
  ['boat', 'rudern|segeln|kanu|kajak|rowing|sailing'], ['golf', 'golf'], ['water', 'schwimm|swim|pool'],
  ['body', 'yoga|stretch|dehnen|pilates|mobility|meditation|meditier'], ['walk', 'laufen|joggen|spazier|running|run |walk|wandern|hike|hiking'],
  ['barbell', 'gym|fitness|kraft|workout|training|trainieren|studio|sport|lifting'], ['trophy', 'wettkampf|turnier|competition|tournament'],
  ['medkit', 'arzt|ärztin|doktor|zahnarzt|doctor|dentist|apotheke|pharmacy|therapie|physio'], ['school', 'schule|uni |universität|vorlesung|berufsschule|ausbildung|school|class|lecture|ihk|prüfung|klausur|exam|seminar|kurs'],
  ['language', 'sprache|englisch|spanisch|französisch|vokabel|duolingo|language'], ['book', 'lernen|lesen|buch|hausaufgabe|study|studying|read|karteikarte|wiederhol'],
  ['briefcase', 'arbeit|job|büro|buero|work|office|schicht|dienst|viactiv|minijob|nebenjob'], ['laptop', 'computer|coding|laptop|hustle|startup|projekt|project|programm|claude|plurafold|business|ki '],
  ['code-slash', 'code|entwickl|develop'], ['easel', 'präsentation|vortrag|presentation|workshop'], ['create', 'schreiben|journal|tagebuch|notizen|write|writing|blog'],
  ['document-text', 'dokument|unterlagen|papierkram|paperwork|bewerbung|steuer'], ['mail', 'mails|e-mail|email|inbox|postfach'], ['call', 'anruf|telefon|call'],
  ['chatbubbles', 'chat|coaching|gespräch|austausch'], ['people', 'freunde|treffen|meeting|familie|team|besuch|friends|family|verabred'],
  ['calendar', 'planung|wochenplan|review|reflexion|rückblick|organis|planning'], ['bar-chart', 'finanzen|budget|analyse|report|statistik|finance'],
  ['calculator', 'mathe|rechnen|math'], ['newspaper', 'nachrichten|zeitung|news'], ['bulb', 'idee|brainstorm|denken|konzept|idea|think'],
  ['cafe', 'frühstück|fruehstueck|breakfast|kaffee|coffee|pause|break'], ['pizza', 'pizza'], ['fast-food', 'burger|fast food|imbiss|snack'],
  ['restaurant', 'essen|mittag|abendbrot|kochen|lunch|dinner|mahlzeit|food|meal|cook'], ['nutrition', 'ernährung|obst|meal prep|nutrition'],
  ['cart', 'einkauf|supermarkt|groceries|besorg|shopping'], ['bag-handle', 'shoppen|bummel|mall'], ['paw', 'hund|katze|gassi|dog|cat|pet'],
  ['cut', 'friseur|haare|barber|haircut'], ['shirt', 'kleidung|outfit|anziehen|wäsche waschen|laundry'],
  ['home', 'haushalt|putzen|wohnung|zuhause|aufräum|aufraeum|wäsche|waesche|home|cleaning|chores'], ['sparkles', 'pflege|skincare|beauty|duschen|shower|bad '],
  ['bed', 'schlaf|bett|nap|sleep|ausschlafen'], ['sunny', 'morgen|aufstehen|wecker|morning|wake'], ['moon', 'abend|nacht|runterfahren|feierabend|evening|night|bedtime'],
  ['airplane', 'flug|flughafen|urlaub|reise|flight|travel|trip|vacation'], ['train', 'bahn|zug|öpnv|train|heimweg|rückweg|hinweg|arbeitsweg|commute|weg '],
  ['bus', 'bus'], ['car', 'auto|fahrt|fahren|fahrschule|pendeln|drive|car '], ['musical-notes', 'musik|gitarre|klavier|singen|band|music|guitar|piano|üben'],
  ['game-controller', 'zocken|gaming|playstation|konsole|xbox|nintendo|game'], ['film', 'film|kino|movie|cinema|netflix'], ['tv', 'fernsehen|serie|tv '],
  ['videocam', 'video|schnitt|capcut|dreh|reel|youtube|content|tiktok|instagram'], ['camera', 'foto|photo'], ['brush', 'kreativ|malen|zeichnen|design|art |adobe|photoshop'],
  ['color-palette', 'basteln|kunst|craft'], ['beer', 'bier|kneipe|bar |party|feiern'], ['wine', 'wein|wine'], ['gift', 'geburtstag|geschenk|birthday'],
  ['flower', 'blumen|pflanzen|plants'], ['leaf', 'natur|garten|draußen|draussen|freizeit|nature|garden|frei'], ['map', 'ausflug|sightseeing|tour|stadt'],
  ['headset', 'podcast|hörbuch|audiobook'], ['mic', 'aufnahme|recording|sprechen'], ['cash', 'geld|bank|money'], ['card', 'bezahlen|rechnung|payment|bill'],
  ['construct', 'reparier|werkstatt|repair|diy'], ['hammer', 'heimwerk|bauen|build'], ['stopwatch', 'intervall|sprint|timer'],
  ['flash', 'energie|power'], ['flame', 'hiit|burn'], ['heart', 'date|freundin|partner|liebe|love|selfcare|self-care']
].map(([k, w]) => [k, w.split('|')]);
function suggestIcon(title){
  const t = ' ' + String(title || '').toLowerCase() + ' ';
  for (const [k, ws] of ICON_KW) if (ws.some(w => t.includes(w))) return k;
  return null;
}
// alte Symbol-Namen (v1/v2) → neue Apple-artige Symbole
const ICON_MAP = { soccer:'football', bike:'bicycle', run:'walk', gym:'barbell', food:'restaurant', coffee:'cafe', sunrise:'sunny', work:'briefcase', video:'videocam',
  music:'musical-notes', game:'game-controller', health:'medkit', phone:'call', pen:'create', plan:'calendar', idea:'bulb', clock:'time' };
function normIcon(k, title){ if (ICON_MAP[k]) k = ICON_MAP[k]; return ALL_ICONS.has(k) ? k : (suggestIcon(title) || 'time'); }

/* ================= Farben ================= */
const COLORS = [
  ['red','#ff3b30','#ff453a','Rot','Red'], ['coral','#ff6b5e','#ff8075','Koralle','Coral'], ['orange','#ff9500','#ff9f0a','Orange','Orange'], ['amber','#ffb340','#ffc15a','Bernstein','Amber'], ['yellow','#ffcc00','#ffd60a','Gelb','Yellow'],
  ['lime','#9bd12b','#aee04a','Limette','Lime'], ['green','#34c759','#30d158','Grün','Green'], ['forest','#248a3d','#2fa84f','Waldgrün','Forest'], ['mint','#00c7be','#63e6e2','Mint','Mint'], ['teal','#30b0c7','#40c8e0','Petrol','Teal'],
  ['cyan','#32ade6','#64d2ff','Cyan','Cyan'], ['blue','#007aff','#0a84ff','Blau','Blue'], ['navy','#1f4fd1','#4c7bff','Marine','Navy'], ['indigo','#5856d6','#5e5ce6','Indigo','Indigo'], ['lavender','#8e8cf0','#a5a3ff','Lavendel','Lavender'],
  ['purple','#af52de','#bf5af2','Lila','Purple'], ['plum','#8e3c9e','#b35fc4','Pflaume','Plum'], ['pink','#ff2d55','#ff375f','Pink','Pink'], ['rose','#e85d9c','#f27ab0','Rosé','Rose'], ['brown','#a2845e','#ac8e68','Braun','Brown'],
  ['sand','#c8a97e','#d4b88f','Sand','Sand'], ['slate','#5b6b82','#8494ad','Schiefer','Slate'], ['gray','#8e8e93','#98989d','Grau','Gray'], ['graphite','#48484a','#7c7c80','Graphit','Graphite']
];
const HEX = /^#[0-9a-f]{6}$/i;
const colorOk = c => typeof c === 'string' && (COLORS.some(x => x[0] === c) || HEX.test(c));
const rgba = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const lum = h => { const n = parseInt(h.slice(1), 16), f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(n >> 16) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255); };
const mixW = (h, a) => { const n = parseInt(h.slice(1), 16), m = v => Math.round(v + (255 - v) * a); return '#' + [n >> 16, n >> 8 & 255, n & 255].map(m).map(v => v.toString(16).padStart(2, '0')).join(''); };
const colStyle = h => `--c:${h};--ct:${rgba(h,.16)};--cs:${rgba(h,.32)};--cg:${rgba(h,.84)};--fg:${lum(h) > .45 ? 'rgba(0,0,0,.72)' : '#fff'}`;
const colSheet = document.createElement('style'); document.head.appendChild(colSheet);
const madeCol = new Set();
(() => {
  let s = '';
  for (const [k, a, b] of COLORS){ s += `.c-${k}{${colStyle(a)}}[data-theme=dark] .c-${k}{${colStyle(b)}}`; madeCol.add(k); }
  colSheet.textContent = s;
})();
// Klasse für eine Farbe (eigene Farben werden bei Bedarf als Regel ergänzt)
function cc(c){
  if (!colorOk(c)) c = 'blue';
  if (c[0] !== '#') return 'c-' + c;
  const k = 'x' + c.slice(1).toLowerCase();
  if (!madeCol.has(k)){ madeCol.add(k); colSheet.textContent += `.c-${k}{${colStyle(c.toLowerCase())}}[data-theme=dark] .c-${k}{${colStyle(mixW(c.toLowerCase(), .12))}}`; }
  return 'c-' + k;
}
const colName = c => { const x = COLORS.find(y => y[0] === c); return x ? L(x[3], x[4]) : L('Eigene Farbe', 'Custom color'); };

/* ================= Datum & Zeit ================= */
const WD_S = () => L(['Mo','Di','Mi','Do','Fr','Sa','So'], ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
const WD_1 = () => L(['M','D','M','D','F','S','S'], ['M','T','W','T','F','S','S']);
const WD_L = () => L(['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'], ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']);
const MON_S = () => L(['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sept.','Okt.','Nov.','Dez.'], ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']);
const MON_L = () => L(['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'], ['January','February','March','April','May','June','July','August','September','October','November','December']);
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const isKey = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && dkey(pd(k)) === k;
const addD = (k, n) => { const d = pd(k); d.setDate(d.getDate() + n); return dkey(d); };
const diffD = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
const wdOf = k => (pd(k).getDay() + 6) % 7 + 1;            // 1 = Montag … 7 = Sonntag
const today = () => dkey(new Date());
const isTime = t => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t) && +t.slice(0, 2) < 24 && +t.slice(3) < 60;
const tmin = t => +t.slice(0, 2) * 60 + +t.slice(3);
const fmtT = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;  // intern immer 24 Std.
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const DAY_END = 1439;
let SYS12 = false;
try { SYS12 = !!new Intl.DateTimeFormat(sysLocale().replace(/_/g, '-'), { hour: 'numeric' }).resolvedOptions().hour12; } catch (e) {}
const use12 = () => D.set.clock === '12' || (D.set.clock === 'auto' && (LANG === 'en' ? SYS12 : false));
// Anzeige einer Uhrzeit (Minuten oder "HH:MM") im gewählten Format
function fT(m){
  if (typeof m === 'string') m = tmin(m);
  if (!use12()) return fmtT(m);
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? 'AM' : 'PM'}`;
}
const fH = h => use12() ? `${h % 12 || 12} ${h % 24 < 12 ? 'AM' : 'PM'}` : pad(h % 24);
const fR = (a, b) => `${fT(a)} – ${fT(b)}`;
const fmtDur = m => { const h = Math.floor(m / 60), r = m % 60; return LANG === 'en' ? (h ? (r ? `${h} hr ${r} min` : `${h} hr`) : `${r} min`) : (h ? (r ? `${h} Std. ${r} Min.` : `${h} Std.`) : `${r} Min.`); };
function fD(k, o = {}){
  const d = pd(k), w = wdOf(k) - 1;
  if (LANG === 'en'){
    let s = `${o.long ? MON_L()[d.getMonth()] : MON_S()[d.getMonth()]} ${d.getDate()}`;
    if (o.year) s += `, ${d.getFullYear()}`;
    if (o.wd === 'long') s = `${WD_L()[w]}, ${s}`; else if (o.wd !== false) s = `${WD_S()[w]}, ${s}`;
    return s;
  }
  let s = `${d.getDate()}. ${o.long ? MON_L()[d.getMonth()] : MON_S()[d.getMonth()]}`;
  if (o.year) s += ` ${d.getFullYear()}`;
  if (o.wd === 'long') s = `${WD_L()[w]}, ${s}`; else if (o.wd !== false) s = `${WD_S()[w]}., ${s}`;
  return s;
}
function rel(k, o){ const n = diffD(today(), k); return n === 0 ? L('Heute', 'Today') : n === 1 ? L('Morgen', 'Tomorrow') : n === -1 ? L('Gestern', 'Yesterday') : fD(k, o); }
function kw(k){ const d = pd(k); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const w1 = new Date(d.getFullYear(), 0, 4, 12); return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); }
const wdOrder = () => D.set.ws === 7 ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
const wkStart = k => addD(k, -((wdOf(k) - D.set.ws + 7) % 7));
const weekKeys = s => [...Array(7)].map((_, i) => addD(s, i));
function daysLabel(days){
  const s = [...days].sort((a, b) => a - b);
  if (s.length === 7) return L('Täglich', 'Daily');
  if (same(s, [1,2,3,4,5])) return L('Mo–Fr', 'Mon–Fri');
  if (same(s, [6,7])) return L('Wochenende', 'Weekends');
  if (!s.length) return L('Kein Tag', 'No day');
  const n = WD_S(), parts = []; let i = 0;
  while (i < s.length){ let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; parts.push(j - i >= 2 ? `${n[s[i]-1]}–${n[s[j]-1]}` : s.slice(i, j + 1).map(x => n[x-1]).join(', ')); i = j + 1; }
  return parts.join(', ');
}

/* ================= Daten ================= */
// Blocker der Master-Woche: { id, title, desc, start, end, days[1=Mo..7=So], color, icon, rt:[{id,title}] = To-Dos bei jedem Termin }
// ov[Datum] = { s: { blockerId: { skip, e:{geänderte Felder} } }, x: [Blocker nur an diesem Tag {…, src = Herkunft, rt = To-Dos der Herkunft zeigen}] }
// chk[Datum][Termin-Id][To-Do-Id] = 1 (abgehakte wiederkehrende To-Dos)
// rto[Datum][Termin-Id][To-Do-Id] = { t: anderer Text, x: 1 = an diesem Tag entfernt } (wiederkehrende To-Dos nur für einen Tag ändern)
// rev[Montag] = Wochenbewertung aus 3.2 (wird nur aufbewahrt, nicht mehr angezeigt)
// todos[].prio = 0 keine, 1 niedrig, 2 mittel, 3 hoch. Erledigte To-Dos werden gelöscht und nur gezählt:
// stat = { n: insgesamt erledigt, d: { Datum: erledigt an diesem Tag } }
const FIELDS = ['title','desc','start','end','color','icon'];
const LEADS = [0, 5, 10, 15, 30], SNAPS = [5, 10, 15, 30], DURS = [15, 30, 45, 60, 90, 120];
const DAY_S = [0, 4, 5, 6, 7, 8, 9, 10], DAY_E = [18, 19, 20, 21, 22, 23, 24];
const defSet = () => ({ theme: 'auto', lang: 'auto', clock: 'auto', ws: 1, snap: 15, dur: 60, dayS: 7, dayE: 23, push: { on: 0, url: '', lead: 0, exp: 0 }, tut: 0 });
const blank = () => ({ v: DATA_V, slots: [], ov: {}, chk: {}, todos: [], rto: {}, rev: {}, stat: { n: 0, d: {} }, set: defSet() });
function fixTimes(o){
  if (tmin(o.end) <= tmin(o.start)){ o.end = fmtT(Math.min(tmin(o.start) + 60, DAY_END)); if (tmin(o.end) <= tmin(o.start)) o.start = fmtT(tmin(o.end) - 1); }
}
function normSlot(s, master){
  const title = str(s.title) ? s.title.slice(0, 80) : L('Ohne Titel', 'Untitled');
  const o = { id: String(s.id || uid()), title, desc: (typeof s.desc === 'string' ? s.desc : typeof s.note === 'string' ? s.note : '').slice(0, 600),
    start: isTime(s.start) ? s.start : '08:00', end: isTime(s.end) ? s.end : '09:00', color: colorOk(s.color) ? s.color : 'blue', icon: normIcon(s.icon, title) };
  fixTimes(o);
  if (master){
    o.days = [...new Set((Array.isArray(s.days) ? s.days : []).map(Number).filter(n => n >= 1 && n <= 7))].sort((a, b) => a - b);
    o.rt = (Array.isArray(s.rt) ? s.rt : []).filter(r => r && str(r.title)).map(r => ({ id: String(r.id || uid()), title: r.title.slice(0, 200) }));
  } else {
    if (str(s.src)) o.src = String(s.src);
    if (s.rt === true) o.rt = true;
  }
  return o;
}
function cleanEdit(e){
  const o = {}; if (!e || typeof e !== 'object') return o;
  if (str(e.title)) o.title = e.title.slice(0, 80);
  if (typeof e.desc === 'string') o.desc = e.desc.slice(0, 600);
  if (isTime(e.start)) o.start = e.start;
  if (isTime(e.end)) o.end = e.end;
  if (colorOk(e.color)) o.color = e.color;
  if (typeof e.icon === 'string'){ const k = ICON_MAP[e.icon] || e.icon; if (ALL_ICONS.has(k)) o.icon = k; }
  return o;
}
function normSet(s){
  const d = defSet(); if (!s || typeof s !== 'object') return d;
  if (['auto','light','dark'].includes(s.theme)) d.theme = s.theme;
  if (['auto','de','en'].includes(s.lang)) d.lang = s.lang;
  if (['auto','24','12'].includes(s.clock)) d.clock = s.clock;
  if (s.ws === 7) d.ws = 7;
  if (SNAPS.includes(s.snap)) d.snap = s.snap;
  if (DURS.includes(s.dur)) d.dur = s.dur;
  if (DAY_S.includes(s.dayS)) d.dayS = s.dayS;
  if (DAY_E.includes(s.dayE)) d.dayE = s.dayE;
  if (s.push && typeof s.push === 'object'){
    d.push.on = s.push.on ? 1 : 0;
    if (typeof s.push.url === 'string' && /^https:\/\/[^\s]+$/.test(s.push.url.trim())) d.push.url = s.push.url.trim().replace(/\/+$/, '');
    if (LEADS.includes(s.push.lead)) d.push.lead = s.push.lead;
    d.push.exp = s.push.exp ? 1 : 0;
  }
  if (+s.tut > 0) d.tut = +s.tut;
  return d;
}
// Gespeicherte Daten jeder Version (auch v1 mit mehreren Plänen, v2 mit Routinen) ins aktuelle Format bringen.
function migrate(d){
  const out = blank();
  if (!d || typeof d !== 'object') return out;
  let src = Array.isArray(d.slots) ? d.slots : null;
  if (!src && Array.isArray(d.plans)){ const p = d.plans.find(x => x && x.id === 'std') || d.plans[0]; src = p && Array.isArray(p.slots) ? p.slots : []; }
  out.slots = (src || []).filter(s => s && typeof s === 'object').map(s => normSlot(s, true));
  const seen = new Set(); for (const s of out.slots){ if (seen.has(s.id)) s.id = uid(); seen.add(s.id); }
  const ids = new Set(out.slots.map(s => s.id));
  if (d.ov && typeof d.ov === 'object') for (const [k, o] of Object.entries(d.ov)){
    if (!isKey(k) || !o || typeof o !== 'object') continue;
    const n = { s: {}, x: [] };
    if (o.s && typeof o.s === 'object') for (const [id, v] of Object.entries(o.s)){
      if (!ids.has(id) || !v || typeof v !== 'object') continue;
      const e = cleanEdit(v.e), r = {}; if (v.skip) r.skip = 1; if (Object.keys(e).length) r.e = e; if (r.skip || r.e) n.s[id] = r;
    }
    if (Array.isArray(o.x)) n.x = o.x.filter(s => s && typeof s === 'object').map(s => normSlot(s, false));
    if (Object.keys(n.s).length || n.x.length) out.ov[k] = n;
  }
  // Haken nur im neuen Format übernehmen (Routinen-Haken aus v1/v2 entfallen mit den Routinen)
  if (d.v >= 3 && d.chk && typeof d.chk === 'object') for (const [k, day] of Object.entries(d.chk)){
    if (!isKey(k) || !day || typeof day !== 'object') continue;
    const n = {};
    for (const [id, m] of Object.entries(day)) if (m && typeof m === 'object'){ const r = {}; for (const [x, v] of Object.entries(m)) if (v) r[x] = 1; if (Object.keys(r).length) n[id] = r; }
    if (Object.keys(n).length) out.chk[k] = n;
  }
  // Zähler für erledigte To-Dos. Beim Umstieg auf v5 zählen bisher erledigte To-Dos und Haken einmal mit,
  // danach werden erledigte To-Dos nicht mehr aufgehoben.
  if (d.stat && typeof d.stat === 'object'){
    out.stat.n = Math.max(0, Math.round(+d.stat.n) || 0);
    if (d.stat.d && typeof d.stat.d === 'object') for (const [k, v] of Object.entries(d.stat.d)) if (isKey(k) && +v > 0) out.stat.d[k] = Math.round(+v);
  }
  const tds = Array.isArray(d.todos) ? d.todos.filter(t => t && str(t.title)) : [];
  if (!(d.v >= 5)){
    for (const t of tds) if (t.done) statAddTo(out.stat, 1, +t.doneAt ? dkey(new Date(+t.doneAt)) : today());
    for (const [k, day] of Object.entries(out.chk)) for (const m of Object.values(day)) statAddTo(out.stat, Object.keys(m).length, k);
  }
  out.todos = tds.filter(t => !t.done).map(t => ({
    id: String(t.id || uid()), title: t.title.slice(0, 200), note: typeof t.note === 'string' ? t.note : '', done: false, doneAt: null,
    due: isKey(t.due) ? t.due : null, at: t.at && isKey(t.at.date) && t.at.slot ? { date: t.at.date, slot: String(t.at.slot) } : null, created: +t.created || Date.now(),
    prio: [1, 2, 3].includes(+t.prio) ? +t.prio : 0 }));
  if (d.rto && typeof d.rto === 'object') for (const [k, day] of Object.entries(d.rto)){
    if (!isKey(k) || !day || typeof day !== 'object') continue;
    const n = {};
    for (const [oid, m] of Object.entries(day)){
      if (!m || typeof m !== 'object') continue;
      const r = {};
      for (const [rid, v] of Object.entries(m)){ if (!v || typeof v !== 'object') continue; const x = {}; if (str(v.t)) x.t = v.t.slice(0, 200); if (v.x) x.x = 1; if (x.t || x.x) r[rid] = x; }
      if (Object.keys(r).length) n[oid] = r;
    }
    if (Object.keys(n).length) out.rto[k] = n;
  }
  if (d.rev && typeof d.rev === 'object') for (const [k, v] of Object.entries(d.rev)){
    if (!isKey(k) || !v || typeof v !== 'object') continue;
    const m = Math.round(+v.m); if (!(m >= 1 && m <= 5)) continue;
    out.rev[k] = { m, n: typeof v.n === 'string' ? v.n.slice(0, 1000) : '', l: typeof v.l === 'string' ? v.l.slice(0, 300) : '', at: +v.at || Date.now() };
  }
  out.set = normSet(d.set);
  return out;
}
// iPhone-App: Die App hält eine zweite Kopie der Daten außerhalb des Web-Speichers (Ordner der App, sichtbar in
// „Dateien“). Beim Start gilt der neuere Stand. So gehen die Daten nicht verloren, falls iOS den Web-Speicher leert.
const MODK = 'sp.mod';
let RESTORED = false;   // true: Der Stand kam beim Start aus der Kopie der App
function nativeStored(){
  try {
    const b = window.__nativeBoot, env = b && typeof b.env === 'string' && b.env ? JSON.parse(b.env) : null;
    if (b) b.env = null;
    return env && env.data && typeof env.data === 'object' ? { mod: +env.mod || 0, data: env.data } : null;
  } catch (e) { return null; }
}
function load(){
  let raw = null, j = null, mod = 0;
  try { raw = localStorage.getItem(KEY); mod = +localStorage.getItem(MODK) || 0; } catch (e) {}
  if (raw){
    try { j = JSON.parse(raw); }
    catch (e) { try { localStorage.setItem('sp.defekt.' + Date.now(), raw); } catch (_) {} raw = null; j = null; }
  }
  const nat = NATIVE ? nativeStored() : null;
  if (nat && (!j || typeof j !== 'object' || nat.mod > mod)){ j = nat.data; raw = null; RESTORED = true; }
  if (!j || typeof j !== 'object') return blank();
  if (raw && j.v !== DATA_V){ try { localStorage.setItem('sp.backup.v' + (j.v || 1), raw); } catch (_) {} }
  return migrate(j);
}
let D = load();
const OCC = new Map();
// Verlauf des Bearbeiten-Modus: Jeder gespeicherte Stand der Sitzung, für Rückgängig und Wiederholen.
// cur = null heißt, der Modus läuft nicht und nichts wird gemerkt.
const HIST = { past: [], next: [], cur: null, mute: false };
function save(){
  OCC.clear();
  let j, ok = false;
  const mod = Date.now();
  try { j = JSON.stringify(D); localStorage.setItem(KEY, j); ok = true; } catch (e) {}
  if (j === undefined){ toast(L('Speichern fehlgeschlagen.', 'Could not save.')); return false; }
  if (ok) try { localStorage.setItem(MODK, String(mod)); } catch (e) {}
  // Kopie für die iPhone-App im selben Format wie ein Backup, damit jede Sicherung über „Backup laden“ lesbar ist
  if (NATIVE && post('save', { mod, env: `{"app":"schedule","version":"${APP_VERSION}","mod":${mod},"data":${j}}` })) ok = true;
  if (!ok){ toast(L('Speichern fehlgeschlagen. Ist der Speicher voll?', 'Could not save. Is the storage full?')); return false; }
  if (HIST.cur !== null && !HIST.mute && j !== HIST.cur){ HIST.past.push(HIST.cur); if (HIST.past.length > 300) HIST.past.shift(); HIST.next = []; HIST.cur = j; }
  schedulePush(); return true;
}
function replaceData(n){ D = n; save(); }

const slotById = id => D.slots.find(s => s.id === id);
const ensureOv = k => D.ov[k] || (D.ov[k] = { s: {}, x: [] });
const ensureOs = (k, id) => { const o = ensureOv(k); return o.s[id] || (o.s[id] = {}); };
function cleanOv(k){
  const o = D.ov[k]; if (!o) return;
  for (const id of Object.keys(o.s)){ const r = o.s[id]; if (r.e && !Object.keys(r.e).length) delete r.e; if (!r.skip && !r.e) delete o.s[id]; }
  if (!Object.keys(o.s).length && !o.x.length) delete D.ov[k];
}
// Alle Termine eines Datums: Master-Woche + Abweichungen nur für diesen Tag
function occ(k){
  if (OCC.has(k)) return OCC.get(k);
  const wd = wdOf(k), o = D.ov[k], out = [];
  for (const s of D.slots){
    if (!s.days.includes(wd)) continue;
    const r = o && o.s[s.id], e = r && r.e;
    const x = { ...s, ...(e || {}), id: s.id, days: s.days, base: s, src: null, extra: false, edited: !!(e && Object.keys(e).length), skipped: !!(r && r.skip), date: k, rt: s.rt };
    if (tmin(x.end) <= tmin(x.start)) x.end = fmtT(Math.min(tmin(x.start) + 30, DAY_END));
    out.push(x);
  }
  if (o) for (const s of o.x){
    const b = s.src ? slotById(s.src) : null;
    out.push({ ...s, desc: s.desc || (b ? b.desc : ''), base: b, src: s.src || null, days: b ? b.days : [], extra: true, edited: false, skipped: false, date: k, rt: s.rt && b ? b.rt : [] });
  }
  out.sort((a, b) => tmin(a.start) - tmin(b.start) || tmin(a.end) - tmin(b.end) || a.title.localeCompare(b.title, LANG));
  OCC.set(k, out);
  return out;
}
const findOcc = (k, id) => occ(k).find(o => o.id === id) || null;
const dayAdjusted = k => occ(k).some(o => o.edited || o.skipped || o.extra);
const rtDone = (k, id, r) => !!(D.chk[k] && D.chk[k][id] && D.chk[k][id][r]);
function setRt(k, id, r, v){
  const day = D.chk[k] || (D.chk[k] = {}), m = day[id] || (day[id] = {});
  if (v) m[r] = 1; else delete m[r];
  if (!Object.keys(m).length) delete day[id];
  if (!Object.keys(day).length) delete D.chk[k];
}
const todosAt = (k, id) => D.todos.filter(t => t.at && t.at.date === k && t.at.slot === id);
function atOcc(t){ if (!t.at) return null; const o = findOcc(t.at.date, t.at.slot); return o && !o.skipped ? o : null; }
const newTodo = (title, at = null, prio = 0) => ({ id: uid(), title, note: '', done: false, doneAt: null, due: null, at, created: Date.now(), prio });
// Wiederkehrende To-Dos an einem Tag anders (t) oder gar nicht (x): ändert nie die Master-Woche
const rtoOf = (k, oid, rid) => (D.rto[k] && D.rto[k][oid] && D.rto[k][oid][rid]) || null;
function setRto(k, oid, rid, patch){
  const day = D.rto[k] || (D.rto[k] = {}), m = day[oid] || (day[oid] = {}), r = m[rid] || (m[rid] = {});
  for (const [f, v] of Object.entries(patch)) if (v) r[f] = v; else delete r[f];
  if (!Object.keys(r).length) delete m[rid];
  if (!Object.keys(m).length) delete day[oid];
  if (!Object.keys(day).length) delete D.rto[k];
}
// Erledigt zählen (n kann -1 sein, wenn ein Haken wieder entfernt wird)
function statAddTo(st, n, k){
  st.n = Math.max(0, st.n + n);
  const v = Math.max(0, (st.d[k] || 0) + n);
  if (v) st.d[k] = v; else delete st.d[k];
}
// Einmaliges To-Do erledigt: Es wird gelöscht und nur gezählt
function finishTodo(id){
  const i = D.todos.findIndex(t => t.id === id); if (i < 0) return false;
  D.todos.splice(i, 1); statAddTo(D.stat, 1, today()); return true;
}
// Wiederkehrendes To-Do abhaken oder den Haken wieder entfernen (mit Zähler)
function checkRt(k, oid, rid, v){ if (rtDone(k, oid, rid) === !!v) return; setRt(k, oid, rid, v); statAddTo(D.stat, v ? 1 : -1, today()); }
// Haken und Tagestexte vergangener Tage braucht niemand mehr; die Tageszähler reichen ein Jahr zurück
function purgeOld(){
  const t = today(), old = addD(t, -400); let ch = false;
  for (const m of [D.chk, D.rto]) for (const k of Object.keys(m)) if (k < t){ delete m[k]; ch = true; }
  for (const k of Object.keys(D.stat.d)) if (k < old){ delete D.stat.d[k]; ch = true; }
  return ch;
}
const doneIn = days => days.reduce((a, k) => a + (D.stat.d[k] || 0), 0);
// Tagesgrenzen aus den Einstellungen in Minuten
const dayS = () => D.set.dayS * 60, dayE = () => Math.min(D.set.dayE * 60, DAY_END);
// Wochen-Schlüssel für Bewertungen: der Montag der Woche, egal ob die Woche am Montag oder Sonntag beginnt
const revKey = ws => { const k = addD(ws, 3); return addD(k, -(wdOf(k) - 1)); };
function unassign(pred){ for (const t of D.todos) if (t.at && pred(t)) t.at = null; }
function resetDayData(k){ const o = D.ov[k]; if (!o) return; const xs = new Set(o.x.map(s => s.id)); unassign(t => t.at.date === k && xs.has(t.at.slot)); delete D.ov[k]; }
