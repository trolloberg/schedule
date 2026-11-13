// Tägliche Sicherungen: Der Ordner öffnet sich in der Dateien-App
(function () {
  const out = { step: 't10' };
  try {
    __skipTut();
    switchTab('set');
    setTimeout(function () { try { A.openBackups(); } catch (e) { __log({ step: 't10-open', error: String(e) }); } }, 600);
    setTimeout(function () { __log({ step: 't10-later', toast: document.querySelector('#toast').innerText, hidden: document.hidden }); }, 3000);
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
