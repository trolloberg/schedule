// Zweiter Start: Umgebung festhalten, Beispielwoche laden, Heute zeigen
(function () {
  const out = { step: 't2' };
  try {
    out.native = NATIVE; out.version = APP_VERSION; out.url = location.href; out.lang = navigator.language; out.info = NINFO; out.ua = navigator.userAgent;
    const pr = document.createElement('div');
    pr.style.cssText = 'position:fixed;top:0;left:0;width:1px;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(pr);
    const cs = getComputedStyle(pr); out.safeTop = cs.paddingTop; out.safeBottom = cs.paddingBottom; pr.remove();
    out.size = innerWidth + 'x' + innerHeight; out.dpr = devicePixelRatio;
    out.tutorial = !!document.querySelector('.tut'); out.storedBefore = !!localStorage.getItem('sp.data.v1');
    out.hidden = document.hidden; out.sw = 'serviceWorker' in navigator; out.secure = window.isSecureContext;
    const t = document.querySelector('.tut'); if (t && t._on) t._on.done();
    if (!D.slots.length) loadSample();
    __clock(1, 9, 12);
    const work = D.slots.find(function (s) { return s.icon === 'briefcase'; });
    if (work && !D.todos.length) {
      D.todos.push(newTodo('Angebot fertig schreiben', { date: today(), slot: work.id }, 3));
      D.todos.push(newTodo('Rückruf Steuerberater', { date: today(), slot: work.id }, 1));
      save();
    }
    if (ui.tab !== 'day') switchTab('day'); else render();
    out.slots = D.slots.length; out.todos = D.todos.length; out.stored = !!localStorage.getItem('sp.data.v1'); out.mod = localStorage.getItem('sp.mod');
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
