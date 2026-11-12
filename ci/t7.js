// Dunkles Erscheinungsbild: Tagesübersicht zeigen
(function () {
  const out = { step: 't7' };
  try {
    out.dark = matchMedia('(prefers-color-scheme: dark)').matches; out.theme = document.documentElement.getAttribute('data-theme'); out.set = D.set.theme;
    __clock(1, 9, 12);
    if (ui.tab !== 'day') switchTab('day');
    setTimeout(function () { dayMode(true); }, 300);
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
