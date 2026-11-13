#!/bin/bash
# Lässt einen Teil der Simulator-Prüfung laufen, aber höchstens so viele Sekunden: wachhund.sh <Sekunden> <Teil>
#
# Die Prüfung läuft losgelöst und schreibt nur in Dateien. Bleibt der Simulator hängen, endet dieser Schritt
# trotzdem pünktlich, und der Bau geht weiter (ein hängender Aufruf hält sonst den ganzen Lauf fest).
set -u
secs="$1"; part="$2"
log="out/log/simtest-$part.txt"
fertig="out/log/.fertig-$part"
zustand="out/log/zustand-$part.txt"
mkdir -p out/log out/bilder
rm -f "$fertig"
( bash ci/simtest.sh "$part"; touch "$fertig" ) > "$log" 2>&1 < /dev/null &
pid=$!
n=0; t0=$SECONDS
while [ ! -f "$fertig" ] && [ "$n" -lt "$secs" ]; do sleep 2; n=$((SECONDS - t0)); done
if [ -f "$fertig" ]; then
  echo "Prüfung „${part}“ fertig nach $n s."
else
  echo "Prüfung „${part}“ nach $n s nicht fertig: wird beendet, der Bau geht weiter."
  echo "abgebrochen nach $n s" >> "$log"
  # Zustand des Rechners festhalten: Was läuft, was steht? Losgelöst, damit auch das den Schritt nicht aufhält.
  # Bewusst nur die Namen der Programme (ohne Argumente), dazu die Aufrufe von simctl.
  (
    date; uptime
    echo "---- simctl"; pgrep -fl simctl
    echo "---- Speicher"; memory_pressure -Q
    echo "---- Programme nach Rechenzeit"; ps -Ao pid,ppid,stat,%cpu,%mem,etime,comm -r | head -40 | cut -c1-160
  ) > "$zustand" 2>&1 < /dev/null &
  sleep 4
  # Erst merken, was die Prüfung gestartet hat, dann die Prüfung beenden, dann ihre Aufrufe
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    enkel="$(pgrep -P "$child" 2>/dev/null)"
    kill -9 "$child" 2>/dev/null
    for e in $enkel; do pkill -9 -P "$e" 2>/dev/null; kill -9 "$e" 2>/dev/null; done
  done
  kill -9 "$pid" 2>/dev/null
fi
rm -f "$fertig"
cat "$log" || true
if [ -f "$zustand" ]; then echo "---- Zustand des Rechners ----"; cat "$zustand" || true; fi
exit 0
