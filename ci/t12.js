// Alles löschen: Danach muss in den Sicherungen eine Datei „…-vorher.json“ mit dem alten Stand liegen
(function () {
  const out = { step: 't12' };
  try { out.before = D.slots.length; replaceData(blank()); refreshAll(); out.after = D.slots.length; switchTab('week'); } catch (e) { out.error = String((e && e.stack) || e); }
  __log(out);
})();
