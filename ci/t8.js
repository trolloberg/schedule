// Backup sichern: Das Teilen-Menü von iOS muss sich öffnen
(function () {
  const out = { step: 't8' };
  try {
    __skipTut();
    switchTab('set');
    setTimeout(function () { try { exportData(); } catch (e) { __log({ step: 't8-export', error: String(e) }); } }, 600);
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
