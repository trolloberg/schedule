// Vierter Start: Web-Speicher leeren und neu laden. Die Daten müssen aus der Kopie der App zurückkommen.
(function () {
  const out = { step: 't4' };
  try {
    if (!sessionStorage.getItem('t4') && window.name !== 't4') {
      sessionStorage.setItem('t4', '1'); window.name = 't4';
      out.phase = 1; out.slots = D.slots.length;
      localStorage.clear();
      out.cleared = !localStorage.getItem('sp.data.v1');
      __log(out);
      post('reload');
      return;
    }
    out.phase = 2; out.slots = D.slots.length; out.todos = D.todos.length; out.restored = RESTORED; out.stored = !!localStorage.getItem('sp.data.v1');
    switchTab('set');
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
