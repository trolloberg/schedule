// Erster Start: nichts anfassen, nur messen, wann WebKit die Ränder liefert und ob die Seite vorher schon richtig steht
(function () {
  const out = { step: 't1' };
  try {
    out.safe = __safe(); out.tutorial = !!document.querySelector('.tut');
    const skip = document.querySelector('.tut .skip'); out.skipTop = skip ? Math.round(skip.getBoundingClientRect().top) : null;
    let n = 0;
    const poll = function () {
      const s = __safe();
      if (parseFloat(s.env) > 0 || ++n > 300) { __log({ step: 't1-env', safe: s, polls: n }); setTimeout(function () { __log({ step: 't1-later', safe: __safe() }); }, 1500); return; }
      requestAnimationFrame(poll);
    };
    poll();
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
