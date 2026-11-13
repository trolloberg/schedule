// Mitteilungen: Seite öffnen, einschalten und eine Test-Mitteilung auslösen
// (in der Prüfung mit stiller Erlaubnis, damit keine Rückfrage von iOS im Weg steht)
(function () {
  const out = { step: 't5' };
  try {
    ui.sub = ['push']; switchTab('set');
    out.before = pushStatus(); out.on = D.set.push.on;
    setTimeout(function () { try { A.pushToggle(); } catch (e) { __log({ step: 't5-toggle', error: String(e) }); } }, 700);
    setTimeout(function () { try { A.pushTest(); } catch (e) { __log({ step: 't5-test', error: String(e) }); } }, 3200);
    setTimeout(function () { __log({ step: 't5-later', on: D.set.push.on, status: pushStatus(), text: document.querySelector('#page').innerText.replace(/\s+/g, ' ').slice(-260) }); }, 5200);
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
