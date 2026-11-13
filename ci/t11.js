// Tastatur: To-Do hinzufügen öffnen und ins Feld tippen. Das Blatt muss über der Tastatur lesbar bleiben.
(function () {
  const out = { step: 't11' };
  try {
    __clock(1, 9, 12);
    if (ui.tab !== 'day') switchTab('day');
    const add = document.querySelector('[data-a="fAdd"]'); out.button = !!add;
    if (add) add.click();
    const inp = document.querySelector('.layer [name=nt]'); out.field = !!inp;
    if (inp) { inp.focus(); inp.value = 'Präsentation vorbereiten'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    out.active = document.activeElement && document.activeElement.name;
    setTimeout(function () {
      const vv = window.visualViewport;
      __log({ step: 't11-later', active: document.activeElement && document.activeElement.name, inner: innerHeight, vv: vv ? Math.round(vv.height) + '@' + Math.round(vv.offsetTop) : '-', scrollY: Math.round(window.scrollY), safe: __safe() });
    }, 3000);
  } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
