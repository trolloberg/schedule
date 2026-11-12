// Mitteilungen: Seite öffnen und einschalten (iOS fragt um Erlaubnis)
(function () {
  const out = { step: 't5' };
  try {
    ui.sub = ['push']; switchTab('set');
    out.before = pushStatus(); out.on = D.set.push.on;
    setTimeout(function () { try { A.pushToggle(); } catch (e) { __log({ step: 't5-toggle', error: String(e) }); } }, 700);
    setTimeout(function () { __log({ step: 't5-later', on: D.set.push.on, status: pushStatus(), text: document.querySelector('#page').innerText.replace(/\s+/g, ' ').slice(-200) }); }, 4500);
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
