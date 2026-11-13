# Schedule – iPhone-App

Schedule als echte iPhone-App. Die App läuft komplett ohne Internet, alle Daten bleiben auf dem iPhone.
Sie wird nicht im App Store veröffentlicht, sondern direkt aufs eigene iPhone geladen.

**Für Entwickler:** Aufbau, Brücke zwischen Swift und Oberfläche, Datenmodell, Bauen und alle Dateien stehen in [`README-Entwickler.md`](README-Entwickler.md).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `Schedule/` | Die iPhone-App (Swift). Sie zeigt die Oberfläche aus `Schedule/www/index.html` bildschirmfüllend und verbindet sie mit dem iPhone: Datenkopie, Erinnerungen, Teilen-Menü, Statusleiste, Tippgefühl. |
| `Schedule.xcodeproj/` | Das Xcode-Projekt. |
| `web-src/` | Quellen der Oberfläche. `python3 web-src/build.py` baut daraus `Schedule/www/index.html`. |
| `web-src/tests/` | Automatische Prüfungen der Oberfläche (Playwright). `tnative.js` prüft das Zusammenspiel mit der App, `tmigrate.js` den Umzug mit einem Backup aus der Web-App 3.3.0. |
| `ci/` | Skripte, mit denen die App beim Bauen im Simulator geprüft wird. |
| `.github/workflows/ios.yml` | Baut die App auf GitHub, erzeugt die App-Datei `Schedule.ipa` und prüft die App im Simulator (iPhone 17 Pro). |

## App-Datei bauen

Bei jeder Änderung in diesem Zweig baut GitHub die App neu. Von Hand geht es unter
**Actions › iOS-App bauen › Run workflow**. Das Ergebnis (App-Datei, Bildschirmfotos, Protokolle) landet im Zweig `ios-build`.

Der Zweig `ios-build` ist so öffentlich wie das ganze Repository. Wer die App-Datei nicht öffentlich liegen lassen will,
lädt sie herunter und löscht den Zweig danach. Beim nächsten Bau entsteht er neu.

Die App-Datei ist nicht signiert. Signiert wird sie erst beim Laden aufs iPhone, mit der eigenen Apple-ID.

## Aufs iPhone laden

- **Windows oder Mac ohne Xcode:** `Schedule.ipa` mit Sideloadly und der eigenen Apple-ID aufs iPhone laden.
- **Mac mit Xcode:** `Schedule.xcodeproj` öffnen, unter *Signing & Capabilities* das eigene Team wählen, iPhone anschließen, auf ▶ drücken.

Mit einer kostenlosen Apple-ID läuft die App 7 Tage und wird dann einfach neu geladen. Die Daten bleiben dabei erhalten.
Die ausführliche Schritt-für-Schritt-Anleitung steht in `ANLEITUNG.md`.

## Wo die Daten liegen

- Im Web-Speicher der App und zusätzlich als Kopie in der App (`Application Support/Schedule/daten.json`).
- Eine Sicherung pro Tag (die letzten 14) in **Dateien › Auf meinem iPhone › Schedule › Sicherungen**.
- Über **Einstellungen › Backup sichern** lässt sich jederzeit eine Datei speichern, zum Beispiel in iCloud Drive.
