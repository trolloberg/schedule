// Backup laden: Die Dateiauswahl von iOS muss sich öffnen
(function () {
  const out = { step: 't9' };
  try {
    switchTab('set');
    const inp = document.querySelector('#imp'); out.input = !!inp; out.accept = inp && inp.accept;
    if (inp) inp.click();
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
