#!/bin/bash
# Startet die App mehrmals im Simulator, lässt sie sich selbst prüfen und macht Bildschirmfotos.
# Erwartet: UDID (Simulator), BUNDLE (Kennung der App), Ordner out/bilder und out/log.
#
# Jeder Aufruf des Simulators hat eine Zeitgrenze, und nach jedem Start wird das Protokoll gesichert.
# Bleibt der Simulator hängen, endet die Prüfung trotzdem sauber und der Rest des Baus läuft weiter.
set -u
B="$BUNDLE"; U="$UDID"; OUT=out
BUDGET=600      # Sekunden für alle Starts zusammen, danach wird nur noch eingesammelt
T0=$SECONDS
FIRST=1
DATA=""

# limit <Sekunden> <Befehl …>: Befehl mit Zeitgrenze ausführen. Rückgabe 124, wenn er beendet werden musste.
limit() {
  local secs="$1"; shift
  "$@" &
  local pid=$! rc=0
  (
    n=0
    while kill -0 "$pid" 2>/dev/null; do
      if [ "$n" -ge "$secs" ]; then pkill -9 -P "$pid" 2>/dev/null; kill -9 "$pid" 2>/dev/null; exit 0; fi
      sleep 1; n=$((n + 1))
    done
  ) >/dev/null 2>&1 &
  local guard=$!
  wait "$pid" 2>/dev/null || rc=$?
  wait "$guard" 2>/dev/null || true
  if [ "$rc" -eq 137 ]; then rc=124; fi
  return "$rc"
}

# Protokoll der App sichern (nach jedem Start, falls später etwas hängt)
keep() {
  if [ -z "$DATA" ]; then DATA="$(limit 20 xcrun simctl get_app_container "$U" "$B" data 2>/dev/null)" || DATA=""; fi
  [ -n "$DATA" ] || return 0
  cp "$DATA/Library/Caches/test-log.txt" "$OUT/log/test-log.txt" 2>/dev/null || true
}

stop() { limit 20 xcrun simctl terminate "$U" "$B" >/dev/null 2>&1 || true; }

shot() { limit 30 xcrun simctl io "$U" screenshot "$OUT/bilder/$1.png" >/dev/null 2>&1 || echo "Bild fehlgeschlagen: $1"; }

run() { # Name, Wartezeit in Sekunden, Skript (optional)
  local name="$1" pause="$2" js="${3:-}" max=60 t rc=0
  if [ $((SECONDS - T0)) -gt "$BUDGET" ]; then echo "Zeit um, übersprungen: $name"; return 0; fi
  stop
  sleep 1
  if [ -n "$js" ]; then
    SIMCTL_CHILD_SCHEDULE_TEST_JS="$(cat ci/prelude.js "$js")"; export SIMCTL_CHILD_SCHEDULE_TEST_JS
  else
    unset SIMCTL_CHILD_SCHEDULE_TEST_JS
  fi
  # Der erste Start nach dem Hochfahren des Simulators dauert lange
  if [ "$FIRST" = 1 ]; then max=300; FIRST=0; fi
  t=$SECONDS
  limit "$max" xcrun simctl launch "$U" "$B" -AppleLanguages "(de)" -AppleLocale de_DE || rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "Start fehlgeschlagen: $name (Code $rc nach $((SECONDS - t)) s)"
    shot "$name-fehler"
    return 0
  fi
  echo "gestartet: $name (nach $((SECONDS - T0)) s)"
  sleep "$pause"
  shot "$name"
  keep
}

run 01-erster-start 20 ci/t1.js
run 02-heute 12 ci/t2.js
run 03-woche 10 ci/t3.js
run 04-einstellungen 13 ci/t4.js
export SIMCTL_CHILD_SCHEDULE_TEST_PROVISIONAL=1
run 05-mitteilungen 12 ci/t5.js
unset SIMCTL_CHILD_SCHEDULE_TEST_PROVISIONAL
limit 20 xcrun simctl ui "$U" appearance dark || true
run 06-dunkel 10 ci/t7.js
limit 20 xcrun simctl ui "$U" appearance light || true
# Alles löschen: Die App muss den Stand von vorher als Sicherung aufheben
run 07-geleert 8 ci/t12.js
run 08-nach-dem-leeren 8
# Home-Bildschirm mit dem App-Symbol
stop
sleep 3
shot 09-home-bildschirm
# Ab hier öffnet die App Fenster von iOS (Teilen-Menü, Dateiauswahl, Dateien-App, Tastatur)
run 10-backup-sichern 11 ci/t8.js
run 11-backup-laden 11 ci/t9.js
run 12-sicherungen 14 ci/t10.js
run 13-tastatur 10 ci/t11.js
stop
sleep 1

keep
if [ -n "$DATA" ]; then
  (cd "$DATA" && find Documents "Library/Application Support" -type f -exec ls -la {} \;) > "$OUT/log/dateien.txt" 2>&1
  cp "$DATA/Library/Application Support/Schedule/daten.json" "$OUT/log/daten.json" 2>/dev/null || true
fi
echo "---- Prüfprotokoll ----"
cat "$OUT/log/test-log.txt" 2>/dev/null || echo "kein Prüfprotokoll gefunden"
echo "---- Dateien der App ----"
cat "$OUT/log/dateien.txt" 2>/dev/null || true
echo "Dauer: $((SECONDS - T0)) s"
exit 0
