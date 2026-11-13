#!/bin/bash
# Startet die App mehrmals im Simulator, lässt sie sich selbst prüfen und macht Bildschirmfotos.
# Aufruf: simtest.sh app   Prüfungen der App selbst (Start, Daten, Erinnerungen, Dunkel, Alles löschen)
#         simtest.sh ios   Fenster von iOS (Teilen-Menü, Dateiauswahl, Dateien-App, Tastatur)
# Erwartet: UDID (Simulator), BUNDLE (Kennung der App), Ordner out/bilder und out/log.
#
# Der Simulator auf GitHub bleibt manchmal hängen, vor allem nachdem ein Fenster von iOS offen war.
# Deshalb hat jeder Aufruf eine Zeitgrenze, das Protokoll wird nach jedem Start gesichert, und nach der
# ersten Zeitüberschreitung hört dieser Teil auf. Gestartet wird über ci/wachhund.sh.
set -u
PART="${1:-app}"
B="$BUNDLE"; U="$UDID"; OUT=out
T0=$SECONDS
FIRST=1
STOPPED=0
DATA=""
[ "$PART" = app ] || FIRST=0

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

# Protokoll der App sichern (nach jedem Start, falls später etwas hängt).
# Der Ordner der App wird auf der Platte gesucht: Das geht auch, wenn der Simulator nicht mehr antwortet.
keep() {
  local f
  if [ -z "$DATA" ] || [ ! -d "$DATA" ]; then
    f="$(find "$HOME/Library/Developer/CoreSimulator/Devices/$U/data/Containers/Data/Application" -maxdepth 4 -path '*/Library/Caches/test-log.txt' 2>/dev/null | head -1)"
    if [ -n "$f" ]; then DATA="${f%/Library/Caches/test-log.txt}"; fi
  fi
  [ -n "$DATA" ] && [ -d "$DATA" ] || return 0
  cp "$DATA/Library/Caches/test-log.txt" "$OUT/log/test-log.txt" 2>/dev/null || true
  (cd "$DATA" && find Documents "Library/Application Support" -type f -exec ls -la {} \;) > "$OUT/log/dateien.txt" 2>&1 || true
  cp "$DATA/Library/Application Support/Schedule/daten.json" "$OUT/log/daten.json" 2>/dev/null || true
}

say() { echo "[$((SECONDS - T0)) s] $*"; }

# Last des Rechners (1, 5 und 15 Minuten): zeigt, ob der Simulator nur langsam ist oder wirklich steht
last() { sysctl -n vm.loadavg 2>/dev/null || cut -d' ' -f1-3 /proc/loadavg 2>/dev/null || echo "?"; }

stop() {
  [ "$STOPPED" = 1 ] && return 0
  local rc=0
  limit 20 xcrun simctl terminate "$U" "$B" >/dev/null 2>&1 || rc=$?
  # 124 heißt: Der Simulator hat nicht geantwortet. Alles andere ist in Ordnung (zum Beispiel: App lief gar nicht).
  if [ "$rc" -eq 124 ]; then say "Beenden der App hängt. Dieser Teil hört hier auf."; STOPPED=1; fi
  return 0
}

shot() {
  local rc=0
  limit 30 xcrun simctl io "$U" screenshot "$OUT/bilder/$1.png" >/dev/null 2>&1 || rc=$?
  if [ "$rc" -ne 0 ]; then say "Bild fehlgeschlagen: $1 (Code $rc)"; fi
  if [ "$rc" -eq 124 ]; then say "Bildschirmfoto hängt. Dieser Teil hört hier auf."; STOPPED=1; fi
  return 0
}

run() { # Name, Wartezeit in Sekunden, Skript (optional)
  local name="$1" pause="$2" js="${3:-}" max=60 t rc=0
  if [ "$STOPPED" = 1 ]; then say "übersprungen: $name"; return 0; fi
  stop
  if [ "$STOPPED" = 1 ]; then say "übersprungen: $name"; return 0; fi
  sleep 1
  if [ -n "$js" ]; then
    SIMCTL_CHILD_SCHEDULE_TEST_JS="$(cat ci/prelude.js "$js")"; export SIMCTL_CHILD_SCHEDULE_TEST_JS
  else
    unset SIMCTL_CHILD_SCHEDULE_TEST_JS
  fi
  # Der erste Start nach dem Hochfahren des Simulators dauert lange (im zweiten Lauf 2 Minuten 40)
  if [ "$FIRST" = 1 ]; then max=420; FIRST=0; fi
  t=$SECONDS
  limit "$max" xcrun simctl launch "$U" "$B" -AppleLanguages "(de)" -AppleLocale de_DE || rc=$?
  if [ "$rc" -ne 0 ]; then
    say "Start fehlgeschlagen: $name (Code $rc nach $((SECONDS - t)) s, Last $(last)). Dieser Teil hört hier auf."
    shot "$name-fehler"
    STOPPED=1
    return 0
  fi
  say "gestartet: $name (Start dauerte $((SECONDS - t)) s, Last $(last))"
  sleep "$pause"
  shot "$name"
  [ "$STOPPED" = 1 ] || keep
}

if [ "$PART" = app ]; then
  run 01-erster-start 20 ci/t1.js
  run 02-heute 12 ci/t2.js
  run 03-woche 10 ci/t3.js
  run 04-einstellungen 13 ci/t4.js
  export SIMCTL_CHILD_SCHEDULE_TEST_PROVISIONAL=1
  run 05-mitteilungen 12 ci/t5.js
  unset SIMCTL_CHILD_SCHEDULE_TEST_PROVISIONAL
  [ "$STOPPED" = 1 ] || limit 20 xcrun simctl ui "$U" appearance dark || say "Umschalten auf Dunkel fehlgeschlagen"
  run 06-dunkel 10 ci/t7.js
  [ "$STOPPED" = 1 ] || limit 20 xcrun simctl ui "$U" appearance light || say "Umschalten auf Hell fehlgeschlagen"
  # Alles löschen: Die App muss den Stand von vorher als Sicherung aufheben
  run 07-geleert 8 ci/t12.js
  run 08-nach-dem-leeren 8
  # Home-Bildschirm mit dem App-Symbol
  if [ "$STOPPED" != 1 ]; then stop; sleep 3; shot 09-home-bildschirm; fi
else
  # Das Wichtigste zuerst (falls der Simulator danach stehen bleibt): die Dateiauswahl für den Umzug der Daten.
  # Die Dateien-App kommt zuletzt, weil dabei eine andere App nach vorn kommt.
  run 10-backup-laden 11 ci/t9.js
  run 11-backup-sichern 11 ci/t8.js
  run 12-tastatur 10 ci/t11.js
  run 13-sicherungen 14 ci/t10.js
  stop
fi

# Das Protokoll liegt auf der Platte des Macs: Es lässt sich auch einsammeln, wenn der Simulator nicht mehr antwortet
keep
say "Teil „${PART}“ zu Ende"
echo "---- Prüfprotokoll ----"
cat "$OUT/log/test-log.txt" 2>/dev/null || echo "kein Prüfprotokoll gefunden"
echo "---- Dateien der App ----"
cat "$OUT/log/dateien.txt" 2>/dev/null || true
echo "Dauer: $((SECONDS - T0)) s"
exit 0
