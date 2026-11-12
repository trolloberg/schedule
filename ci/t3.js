// Dritter Start: Sind die Daten nach dem Beenden noch da? Dann die Woche zeigen.
(function () {
  const out = { step: 't3' };
  try {
    out.slots = D.slots.length; out.todos = D.todos.length; out.restored = RESTORED; out.stored = !!localStorage.getItem('sp.data.v1');
    out.tut = D.set.tut; out.tutorial = !!document.querySelector('.tut');
    __clock(3, 17, 40);
    switchTab('week');
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
