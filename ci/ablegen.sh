#!/bin/bash
# Legt den Ordner out/ (App-Datei, Bildschirmfotos, Protokolle) im Zweig ios-build ab: ablegen.sh <Stand>
# Läuft mehrmals im selben Bau, damit die App-Datei schon da ist, bevor der Simulator geprüft wird.
# Erwartet: GH_TOKEN, GITHUB_SHA, GITHUB_RUN_ID, GITHUB_REPOSITORY.
set -u
stand="${1:-Ende}"
mkdir -p out
cd out
echo "Commit $GITHUB_SHA, Lauf $GITHUB_RUN_ID, Stand: $stand" > stand.txt
[ -d .git ] || git init -q -b ios-build
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "Build ${GITHUB_SHA::7} ($stand)" || true
git push -q -f "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" ios-build
echo "abgelegt: $stand"
