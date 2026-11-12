// Hilfen für die automatische Prüfung im Simulator (läuft nur in Debug-Builds der App)
window.__log = function (o) { try { post('log', { m: JSON.stringify(o) }); } catch (e) {} };
// Uhr auf einen Wochentag dieser Woche stellen (1 = Montag), damit die Bilder immer gleich aussehen
window.__clock = function (wd, hh, mm) {
  if (!window.__RD) {
    window.__RD = Date; window.__off = 0;
    window.Date = class extends window.__RD {
      constructor(...a) { if (a.length) super(...a); else super(window.__RD.now() + window.__off); }
      static now() { return window.__RD.now() + window.__off; }
    };
  }
  const n = new Date(), t = pd(addD(wkStart(today()), wd - 1));
  t.setHours(hh, mm, 0, 0);
  window.__off += t - n;
  tick(); render();
};
