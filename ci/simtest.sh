#!/bin/bash
# Startet die App mehrmals im Simulator, lässt sie sich selbst prüfen und macht Bildschirmfotos.
# Erwartet: UDID (Simulator), BUNDLE (Kennung der App), Ordner out/bilder und out/log.
set -u
B="$BUNDLE"; U="$UDID"; OUT=out

run() { # Name, Wartezeit in Sekunden, Skript (optional)
  local name="$1" wait="$2" js="${3:-}"
  xcrun simctl terminate "$U" "$B" >/dev/null 2>&1 || true
  sleep 1
  if [ -n "$js" ]; then
    SIMCTL_CHILD_SCHEDULE_TEST_JS="$(cat ci/prelude.js "$js")"; export SIMCTL_CHILD_SCHEDULE_TEST_JS
  else
    unset SIMCTL_CHILD_SCHEDULE_TEST_JS
  fi
  xcrun simctl launch "$U" "$B" -AppleLanguages "(de)" -AppleLocale de_DE || echo "Start fehlgeschlagen: $name"
  sleep "$wait"
  xcrun simctl io "$U" screenshot "$OUT/bilder/$name.png" >/dev/null 2>&1 || echo "Bild fehlgeschlagen: $name"
}

run 01-erster-start 20 ci/t1.js
run 02-heute 12 ci/t2.js
run 03-woche 10 ci/t3.js
run 04-einstellungen 13 ci/t4.js
export SIMCTL_CHILD_SCHEDULE_TEST_PROVISIONAL=1
run 05-mitteilungen 12 ci/t5.js
unset SIMCTL_CHILD_SCHEDULE_TEST_PROVISIONAL
run 06-tastatur 10 ci/t11.js
run 07-backup-sichern 11 ci/t8.js
run 08-backup-laden 11 ci/t9.js
xcrun simctl ui "$U" appearance dark || true
run 09-dunkel 10 ci/t7.js
xcrun simctl ui "$U" appearance light || true
# Home-Bildschirm mit dem App-Symbol
xcrun simctl terminate "$U" "$B" >/dev/null 2>&1 || true
sleep 3
xcrun simctl io "$U" screenshot "$OUT/bilder/10-home-bildschirm.png" >/dev/null 2>&1 || true
run 11-sicherungen 14 ci/t10.js
# Alles löschen: Die App muss den Stand von vorher als Sicherung aufheben
run 12-geleert 8 ci/t12.js
run 13-nach-dem-leeren 8
xcrun simctl terminate "$U" "$B" >/dev/null 2>&1 || true
sleep 1

DATA="$(xcrun simctl get_app_container "$U" "$B" data)"
cp "$DATA/Library/Caches/test-log.txt" "$OUT/log/test-log.txt" 2>/dev/null || echo "kein Prüfprotokoll gefunden"
(cd "$DATA" && find Documents "Library/Application Support" -type f -exec ls -la {} \;) > "$OUT/log/dateien.txt" 2>&1
cp "$DATA/Library/Application Support/Schedule/daten.json" "$OUT/log/daten.json" 2>/dev/null || true
echo "---- Prüfprotokoll ----"
cat "$OUT/log/test-log.txt" 2>/dev/null || true
echo "---- Dateien der App ----"
cat "$OUT/log/dateien.txt"
