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
// Ränder messen: was WebKit meldet (env), was die Seite benutzt (--safe-t/--safe-b) und ob die Werte der App noch gesetzt sind
window.__safe = function () {
  const pr = document.createElement('div');
  pr.style.cssText = 'position:fixed;top:0;left:0;width:1px;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);margin-top:var(--safe-t);margin-bottom:var(--safe-b)';
  document.body.appendChild(pr);
  const cs = getComputedStyle(pr);
  const out = { env: cs.paddingTop + '/' + cs.paddingBottom, used: cs.marginTop + '/' + cs.marginBottom, nst: document.documentElement.style.getPropertyValue('--nst') || '-', at: Math.round(performance.now()) };
  pr.remove();
  return out;
};
