# Schedule

Persönlicher Wochenplan fürs iPhone, als Web-App (PWA): eine Master-Woche mit Blockern, „Heute“ als Zeitstrahl, eine Wochenansicht, die man durch Gedrückthalten bearbeitet, und „Productivity“ mit To-Dos, Wochen-Statistik und Wochenbewertung. Die Daten bleiben auf dem Gerät.

**App:** https://trolloberg.github.io/schedule/

## Aufs iPhone holen
1. Den Link in Safari öffnen.
2. Teilen → „Zum Home-Bildschirm“.
3. Einmal mit Internet starten, danach läuft die App auch offline.

Umzug von der alten Adresse (`london-navigator/stundenplan/`): In der alten App unter Einstellungen „Backup sichern“, in der neuen „Backup laden“.

## Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | die ganze App, HTML, CSS und JavaScript in einer Datei |
| `sw.js` | Offline-Cache und Empfang der Mitteilungen. Bei jedem Update `VERSION` hochzählen |
| `manifest.webmanifest`, `icon-*.png` | Name und Icons für den Home-Bildschirm |
| `push-server/worker.js` | optionaler Push-Server für Cloudflare Workers, kennt nur Uhrzeiten |

Kein Build, keine Abhängigkeiten. GitHub Pages veröffentlicht den Branch `gh-pages` direkt.
