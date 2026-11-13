# Schedule als echte iPhone-App installieren

Stand: 13.11.2026

## Kurz erklärt

Schedule ist jetzt eine echte iPhone-App, die du einmal vom Computer aufs iPhone lädst. Sie läuft komplett ohne Internet. Deine Daten bleiben auf dem iPhone. Erinnerungen kommen vom iPhone selbst, ohne Server.

So läuft es ab:

1. Du sicherst deine Daten aus der alten Web-App.
2. Du installierst auf dem Computer das kostenlose Programm Sideloadly.
3. Sideloadly lädt die Datei `Schedule.ipa` auf dein iPhone.
4. Du gibst die App auf dem iPhone frei und lädst deine Daten hinein.

Beim ersten Mal dauert das etwa 30 Minuten.

Eines musst du vorher wissen: Die App kommt nicht aus dem App Store. Mit einer kostenlosen Apple-ID lässt Apple solche Apps nur 7 Tage laufen. Danach wird die App erneuert. Das dauert zwei Minuten, und deine Daten bleiben erhalten. Wie das geht, steht im Abschnitt „Alle 7 Tage: App erneuern“.

Die Anleitung ist für einen Windows-PC geschrieben. Mit einem Mac geht es fast genauso, siehe „Alternative Wege“ ganz unten.

## Das brauchst du

Du brauchst vier Dinge. Kaufen musst du dafür nichts.

- **Dein iPhone und das Ladekabel.** Das Kabel muss Daten übertragen können. Das Kabel aus der iPhone-Schachtel kann das.
- **Einen Windows-PC mit Internet.** Am besten Windows 10 oder 11.
- **Eine Apple-ID mit Passwort.** Apple nennt sie inzwischen „Apple Account“. Gemeint ist dasselbe.
- **Die Datei `Schedule.ipa`.** Sie hängt an meiner Nachricht im Chat. Das ist die fertige App.

### Welche Apple-ID?

Nimm eine Apple-ID und bleib für immer bei ihr. Nur mit derselben Apple-ID bleiben deine Daten beim Erneuern erhalten.

Sideloadly ist kein Programm von Apple. Laut Sideloadly gehen Apple-ID und Passwort [nur an die Server von Apple](https://sideloadly.io/faq). Wenn du trotzdem auf Nummer sicher gehen willst, lege eine zweite Apple-ID nur für diesen Zweck an. Das geht kostenlos auf [account.apple.com](https://account.apple.com). Diese zweite Apple-ID muss nicht auf deinem iPhone angemeldet sein.

Apple schickt beim Anmelden einen sechsstelligen Code auf dein iPhone. Halte es also bereit.

## Schritt 1: Daten aus der alten Web-App sichern

Sichere zuerst deine Daten, damit beim Umzug nichts verloren geht. Hast du in der alten App noch nichts eingetragen, kannst du diesen Schritt überspringen.

1. Öffne die alte Schedule-App über ihr Symbol auf dem Home-Bildschirm.
2. Tippe unten auf **Einstellungen**.
3. Tippe im Abschnitt **Daten** auf **Backup sichern**.
4. Es öffnet sich das Teilen-Menü. Tippe auf **In Dateien sichern**.
5. Wähle **iCloud Drive** oder **Auf meinem iPhone** und tippe oben rechts auf **Sichern**.

Die Datei heißt `schedule-backup-` und dahinter das Datum. Merke dir, wo sie liegt.

Lass die alte App vorerst auf dem iPhone. Du entfernst sie erst in Schritt 5, wenn in der neuen App alles da ist.

**Tipp gegen Verwechslung:** Beide Apps haben dasselbe Symbol. Schiebe das alte Symbol jetzt auf die letzte Seite deines Home-Bildschirms. So weißt du später sicher, welches das alte ist.

## Schritt 2: Computer vorbereiten

Auf dem PC brauchst du drei Programme: iTunes, iCloud und Sideloadly. iTunes und iCloud bringen die Treiber mit, über die der PC mit dem iPhone spricht.

**Wichtig:** Sideloadly braucht iTunes und iCloud [direkt von Apple](https://sideloadly.io), nicht aus dem Microsoft Store. Mit den Store-Versionen findet Sideloadly das iPhone nicht.

1. **Prüfe, ob iTunes oder iCloud schon installiert sind.** Öffne die Windows-Einstellungen, dann **Apps**, dann **Installierte Apps** (unter Windows 10: **Apps & Features**). Suche dort nach „iTunes“ und nach „iCloud“.
2. **Sind sie schon da?** Dann deinstalliere beide, weil du nicht sicher weißt, woher sie stammen. Klick rechts auf die drei Punkte (unter Windows 10 auf den Eintrag selbst) und dann auf **Deinstallieren**. Deine Daten in iCloud bleiben erhalten.
3. **Installiere iTunes von Apple.** Lade [iTunes für Windows (64 Bit)](https://www.apple.com/itunes/download/win64), öffne die geladene Datei und klick dich durch.
4. **Installiere iCloud von Apple.** Lade [iCloud für Windows](https://updates.cdn-apple.com/2020/windows/001-39935-20200911-1A70AA56-F448-11EA-8CC0-99D41950005E/iCloudSetup.exe), öffne die geladene Datei und klick dich durch. Fragt iCloud danach nach einer Anmeldung, kannst du das Fenster schließen.
5. **Starte den PC neu.**
6. **Installiere Sideloadly.** Öffne [sideloadly.io](https://sideloadly.io) und lade die Version für **Windows 64-bit**. Öffne die geladene Datei und klick dich durch. Fragt Windows, ob das Programm Änderungen vornehmen darf, klick auf **Ja**.
7. **Verbinde das iPhone per Kabel mit dem PC** und entsperre es. Auf dem iPhone erscheint „Diesem Computer vertrauen?“. Tippe auf **Vertrauen** und gib deinen iPhone-Code ein.
8. **Öffne iTunes einmal.** Erscheint oben links ein kleines iPhone-Symbol, steht die Verbindung. Danach kannst du iTunes wieder schließen.

**Bevor du etwas deinstallierst:** Nutzt du iTunes bisher für Musik oder für Backups deines iPhones, sag mir kurz Bescheid. Dann schauen wir zuerst nach, wo diese Daten liegen.

## Schritt 3: App aufs iPhone laden

Jetzt lädt Sideloadly die App auf dein iPhone. Das iPhone bleibt dabei am Kabel und entsperrt.

1. **Lade `Schedule.ipa` auf den PC.** Öffne diesen Chat am PC und lade die Datei aus meiner Nachricht herunter. Leg sie in einen festen Ordner, zum Beispiel `Dokumente\Schedule`. Du brauchst sie später wieder.
2. **Öffne Sideloadly.** Oben bei **iDevice** steht jetzt der Name deines iPhones. Steht dort nichts, hilft der Abschnitt „Wenn etwas nicht klappt“.
3. **Zieh `Schedule.ipa` mit der Maus auf das IPA-Symbol** links im Fenster. Du kannst auch auf das Symbol klicken und die Datei auswählen.
4. **Trag bei „Apple ID“ deine Apple-ID ein.** Das ist die E-Mail-Adresse deiner Apple-ID.
5. **Schalte das automatische Erneuern ein.** Sideloadly bietet beim Laden an, die App automatisch zu erneuern (englisch „automatic refresh“). Je nach Version ist das ein Häkchen im Fenster oder eine Frage nach dem Klick auf Start. Stimme zu. Alle anderen Einstellungen lässt du, wie sie sind.
6. **Klick auf „Start“.**
7. **Gib das Passwort deiner Apple-ID ein,** wenn Sideloadly danach fragt.
8. **Gib den sechsstelligen Code ein.** Auf deinem iPhone erscheint eine Meldung, dass sich jemand mit deiner Apple-ID anmelden will. Tippe auf **Erlauben**. Den Code, der dann erscheint, tippst du in Sideloadly ein. Bei einer zweiten Apple-ID kommt der Code per SMS.
9. **Warte, bis unten im Fenster „Done.“ steht.** Das dauert etwa eine Minute.

Auf dem Home-Bildschirm deines iPhones liegt jetzt ein neues Schedule-Symbol. Öffnen lässt es sich noch nicht. Das kommt im nächsten Schritt.

Wenn du lieber zuschaust: Sideloadly zeigt den Ablauf in einem [kurzen Video](https://www.youtube.com/watch?v=vqTsavQc3lQ) (englisch).

## Schritt 4: App auf dem iPhone freigeben

Das iPhone öffnet die App erst, wenn du zwei Dinge erlaubt hast. Beides machst du nur einmal. Das iPhone braucht dafür kurz Internet.

### Dem Entwickler vertrauen

Der „Entwickler“ bist du selbst, denn die App wurde mit deiner Apple-ID aufs iPhone geladen.

1. Öffne auf dem iPhone die **Einstellungen**.
2. Tippe auf **Allgemein** und dann auf **VPN & Geräteverwaltung**.
3. Unter **Entwickler-App** steht deine Apple-ID. Tippe darauf.
4. Tippe auf **„… vertrauen“** und bestätige. Je nach iOS-Version steht dort **Vertrauen**, **Erlauben** oder **Erlauben & neu starten**.

Startet das iPhone dabei neu, ist das richtig so. Steht danach „Nicht überprüft“ bei der App, fehlt das Internet. Verbinde das iPhone mit dem WLAN und tippe auf **App überprüfen**. So beschreibt es [Apple](https://support.apple.com/en-us/118254).

### Den Entwicklermodus einschalten

1. Öffne die **Einstellungen** und tippe auf **Datenschutz & Sicherheit**.
2. Scrolle ganz nach unten und tippe auf **Entwicklermodus**.
3. Schalte den Schalter ein und tippe auf **Neu starten**.
4. Entsperre das iPhone nach dem Neustart. Es fragt, ob der Entwicklermodus eingeschaltet werden soll. Tippe auf **Einschalten** und gib deinen iPhone-Code ein.

Der Entwicklermodus ist eine Sicherheitsabfrage von [Apple](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device) für Apps, die nicht aus dem App Store kommen. Er bleibt danach einfach eingeschaltet. Der Punkt **Entwicklermodus** erscheint erst, nachdem die App aufs iPhone geladen wurde.

Jetzt lässt sich Schedule öffnen. Die Reihenfolge der beiden Teile ist egal.

## Schritt 5: Daten laden, Mitteilungen einschalten, alte App entfernen

Jetzt ziehst du mit deinen Daten in die neue App um.

### Daten laden

1. Öffne die neue Schedule-App.
2. Es erscheint die Einführung. Tippe oben auf **Überspringen**.
3. Tippe unten auf **Einstellungen**.
4. Tippe im Abschnitt **Daten** auf **Backup laden**.
5. Es öffnet sich die Dateiauswahl. Tippe unten auf **Durchsuchen** und dann auf den Ort aus Schritt 1, also **iCloud Drive** oder **Auf meinem iPhone**. Tippe dort auf die Datei. Ihr Name beginnt mit `schedule-backup-`.
6. Bestätige die Frage „Backup laden?“ mit **Laden**.

Unten erscheint kurz „Backup geladen“. Schau unter **Woche** nach, ob deine Blocker da sind.

Hast du Schritt 1 übersprungen, richtest du deine Woche neu ein. Geh dafür die Einführung bis zum Ende durch und tippe auf **Master-Woche einrichten**.

### Mitteilungen einschalten

Die neue App erinnert dich selbst, ohne Server. Deshalb fragt iOS einmal um Erlaubnis.

1. Tippe in den **Einstellungen** der App auf **Mitteilungen**.
2. Schalte **Wenn ein Blocker beginnt** ein.
3. iOS fragt, ob Schedule dir Mitteilungen senden darf. Tippe auf **Erlauben**.
4. Schalte auch **Bevor die App abläuft** ein. Dann meldet sich das iPhone zwei Tage, einen Tag und drei Stunden vor dem Ablauf.
5. Tippe auf **Test-Mitteilung senden**. Nach fünf Sekunden erscheint oben eine Mitteilung.

Fehlt der Schalter **Bevor die App abläuft**, konnte die App ihr Ablaufdatum nicht lesen. Stell dir dann im Kalender eine Erinnerung für den sechsten Tag nach dem Laden und sag mir Bescheid.

### Alte Web-App entfernen

Entferne die alte App erst, wenn in der neuen alles stimmt. Mit ihr verschwinden auch ihre Daten.

1. Finde heraus, welches Symbol das alte ist. Öffne die App und tippe auf **Einstellungen**. Ganz oben steht die Version. Die alte App zeigt **Version 3.3.0**, die neue **Version 4.0.0**.
2. Halte das Symbol der alten App auf dem Home-Bildschirm gedrückt.
3. Tippe im Menü auf **Lesezeichen löschen** und bestätige.

Heißt der Punkt bei dir anders, zum Beispiel **App entfernen**, ist das in Ordnung, solange du vorher die Version geprüft hast.

### So bleiben deine Daten sicher

- Die App legt jeden Tag von selbst eine Sicherung an. Du findest die letzten 14 in der App **Dateien** unter **Auf meinem iPhone › Schedule › Sicherungen**. Am schnellsten kommst du über **Einstellungen › Tägliche Sicherungen** dorthin.
- Diese Sicherungen liegen in der App. Löschst du die App, sind sie weg. Lösche die neue App deshalb nie, um etwas zu reparieren.
- Sichere ab und zu ein Backup in iCloud Drive: **Einstellungen › Backup sichern › In Dateien sichern › iCloud Drive**.

## Alle 7 Tage: App erneuern

Mit einer kostenlosen Apple-ID läuft die App 7 Tage, dann muss sie erneuert werden. Das ist eine [Grenze von Apple](https://sideloadly.io/faq), keine Schwäche der App. Deine Daten bleiben beim Erneuern erhalten.

### So merkst du es rechtzeitig

- Unter **Einstellungen › Über Schedule** steht **Gültig bis** mit Datum und Uhrzeit.
- Zwei Tage vorher zeigt die App einen Hinweis in den Einstellungen.
- Mit dem Schalter **Bevor die App abläuft** bekommst du drei Mitteilungen: zwei Tage, einen Tag und drei Stunden vorher.

### Von selbst erneuern lassen

Sideloadly erneuert die App automatisch, wenn du das in Schritt 3 eingeschaltet hast. Dafür muss der PC laufen und das iPhone für ihn erreichbar sein.

- **Mit Kabel:** Steck das iPhone zweimal pro Woche an den laufenden PC. Mehr musst du nicht tun.
- **Ohne Kabel:** Richte einmal die Verbindung über WLAN ein. Verbinde das iPhone per Kabel und öffne iTunes. Klick auf das iPhone-Symbol und setze unter **Optionen** das Häkchen bei **Mit diesem iPhone über WLAN synchronisieren**. Klick auf **Anwenden**. Danach reicht es, wenn PC und iPhone im selben WLAN sind und der Bildschirm des iPhones an ist.

Verlass dich in den ersten zwei Wochen nicht blind darauf. Schau unter **Gültig bis** nach, ob sich das Datum wirklich verlängert hat.

### Von Hand erneuern

Das geht immer und dauert zwei Minuten.

1. Verbinde das iPhone per Kabel mit dem PC und entsperre es.
2. Öffne Sideloadly.
3. Zieh dieselbe Datei `Schedule.ipa` auf das IPA-Symbol.
4. Trag dieselbe Apple-ID ein wie beim ersten Mal und klick auf **Start**.
5. Warte, bis „Done.“ erscheint.

Die App wird dabei überschrieben, nicht gelöscht. Vertrauen und Entwicklermodus musst du nicht noch einmal einstellen.

### Wenn die 7 Tage schon vorbei sind

Dann lässt sich die App nicht mehr öffnen. Deine Daten sind trotzdem noch da. Lösche die App nicht. Erneuere sie von Hand wie oben, danach ist alles wieder da.

### Drei Regeln, damit nichts verloren geht

1. Nimm immer dieselbe Apple-ID.
2. Lösche die App nie. Installiere immer nur darüber.
3. Sichere ab und zu ein Backup in iCloud Drive.

## Wenn etwas nicht klappt

Fast jedes Problem hat eine bekannte Lösung. Such dir unten die Meldung heraus, die du siehst. Die Lösungen zu Sideloadly stammen aus dessen [Hilfeseite](https://sideloadly.io/faq).

### Am Computer

**Sideloadly zeigt kein iPhone an („no devices detected“).** Entsperre das iPhone und tippe auf **Vertrauen**. Öffne iTunes, während das iPhone verbunden ist. Probier ein anderes Kabel oder einen anderen USB-Anschluss. Hilft das nicht, installiere iTunes und iCloud wie in Schritt 2 neu und starte den PC neu.

**Fehler mit `np_client_new` oder `afc_file_close`.** Auf dem PC ist iTunes aus dem Microsoft Store installiert. Deinstalliere es und installiere iTunes von Apple wie in Schritt 2. Verbinde das iPhone danach einmal mit iTunes.

**Fehler `LOCKDOWN_E_INVALID_HOST_ID`.** Das iPhone vertraut dem PC noch nicht. Tippe auf dem iPhone auf **Vertrauen**. Kommt die Frage nicht, starte den PC mit angestecktem iPhone neu.

**Fehler „Failed to obtain anisette: 500“.** Das ist ein vorübergehender Serverfehler. Versuch es später noch einmal. Oder stell in Sideloadly unter **Advanced Options** auf **Local Anisette** um.

**„Your maximum App ID limit has been reached.“** Apple erlaubt mit einer kostenlosen Apple-ID 10 neue App-Kennungen in 7 Tagen. Warte ein paar Tage. Beim normalen Erneuern passiert das nicht.

**„This device has reached the maximum number of installed apps.“** Mit einer kostenlosen Apple-ID dürfen höchstens 3 selbst geladene Apps gleichzeitig auf dem iPhone sein. Entferne eine andere selbst geladene App.

**„The identity used to sign the executable is no longer valid“ oder „A valid provisioning profile … was not found“.** Datum oder Uhrzeit stimmen nicht. Stell beides am PC und am iPhone auf automatisch.

**„Failed to check for updates: Could not fetch the daemon“.** Lade Sideloadly neu von [sideloadly.io](https://sideloadly.io) und installiere es darüber.

**Sideloadly meldet „Done.“, aber auf dem iPhone ist kein Symbol.** Starte das iPhone neu.

### Am iPhone

**„Nicht vertrauenswürdiger Entwickler“.** Hol Schritt 4, Teil „Dem Entwickler vertrauen“ nach.

**„Entwicklermodus erforderlich“.** Hol Schritt 4, Teil „Den Entwicklermodus einschalten“ nach.

**„Schedule ist nicht mehr verfügbar“.** Die 7 Tage sind um. Erneuere die App von Hand. Lösche sie nicht.

**Es kommen keine Mitteilungen.** Öffne die iPhone-Einstellungen, dann **Mitteilungen**, dann **Schedule**. Schalte **Mitteilungen erlauben** ein. Prüfe in der App unter **Einstellungen › Mitteilungen**, ob der Schalter an ist. Ein aktiver Fokus wie „Nicht stören“ hält Mitteilungen ebenfalls zurück.

**Die Erinnerungen hören nach einiger Zeit auf.** iOS merkt sich höchstens 64 Erinnerungen im Voraus. Öffne die App mindestens einmal pro Woche, dann legt sie nach.

**Die App zeigt eine leere Woche.** Lade dein Backup über **Einstellungen › Backup laden**. Hast du keins, nimm die jüngste Datei aus **Dateien › Auf meinem iPhone › Schedule › Sicherungen**.

**Etwas anderes geht schief.** Schreib mir, was du getan hast und welche Meldung du siehst. Ein Bildschirmfoto hilft am meisten.

## Alternative Wege

Der Weg über Windows und Sideloadly ist der einfachste ohne Mac. Es gibt drei Alternativen.

### Mac mit Sideloadly

Das läuft fast genauso wie oben. Lade Sideloadly für macOS von [sideloadly.io](https://sideloadly.io). iTunes und iCloud brauchst du am Mac nicht. Schritt 2 schrumpft damit auf die Installation von Sideloadly. Stellt Sideloadly am Mac beim ersten Anmelden zusätzliche Fragen, folge den Hinweisen im Programm. Diesen Weg habe ich nicht selbst durchgespielt.

### Mac mit Xcode

Xcode ist Apples eigenes Programm für Apps. Du brauchst dafür kein fremdes Programm, aber einen Mac und etwa 15 GB freien Platz.

1. Installiere **Xcode** kostenlos aus dem Mac App Store und öffne es einmal.
2. Entpacke die Projekt-Datei `Schedule-iPhone-Projekt.zip` aus dem Chat.
3. Öffne darin `Schedule.xcodeproj` mit einem Doppelklick.
4. Klick links oben auf das blaue Symbol **Schedule** und dann auf den Reiter **Signing & Capabilities**.
5. Wähle bei **Team** deine Apple-ID. Steht dort keine, klick auf **Add an Account** und melde dich an.
6. Verbinde das iPhone per Kabel und wähle es oben in der Leiste als Ziel aus.
7. Klick auf den Pfeil **▶** oben links. Xcode baut die App und lädt sie aufs iPhone.
8. Gib die App auf dem iPhone frei wie in Schritt 4.

Auch hier läuft die App mit kostenloser Apple-ID 7 Tage. Zum Erneuern klickst du wieder auf **▶**.

**Achtung beim Wechsel:** Für das iPhone ist die App aus Xcode eine andere App als die aus Sideloadly. Die Daten wandern nicht von selbst mit. Sichere vorher ein Backup und lade es danach in der neuen App.

### Bezahltes Entwicklerkonto

Mit dem [Apple Developer Program](https://developer.apple.com/programs/) für 99 US-Dollar im Jahr läuft die App ein Jahr statt 7 Tage. Der Ablauf bleibt gleich: Du trägst in Sideloadly oder Xcode die Apple-ID mit dem Entwicklerkonto ein. Das lohnt sich erst, wenn dich das wöchentliche Erneuern wirklich stört.

## Was geprüft ist und was nicht

Schedule ist eine echte iPhone-App. Den Rahmen der App habe ich in Swift geschrieben, der Sprache von Apple für Apps. Die Oberfläche ist dieselbe wie in der Web-App. Sie steckt jetzt fest in der App und läuft ohne Internet. Deshalb sieht alles aus wie gewohnt.

**Geprüft habe ich:**

- alle Funktionen der Oberfläche mit 778 automatischen Prüfungen, alle ohne Fehler
- den Umzug: Ein Backup aus der alten Web-App 3.3.0 lädt vollständig in die neue App
- die fertige App im Simulator eines iPhone 17 Pro mit iOS 26.5: Start, Heute, Woche, Einstellungen und Dunkelmodus
- im Simulator außerdem: Daten nach einem Neustart, 59 geplante Erinnerungen, die Sicherung vor dem Löschen, das Symbol auf dem Home-Bildschirm, die Dateiauswahl, das Teilen-Menü, die Tastatur und den Ordner Sicherungen in der Dateien-App

**Nicht prüfen konnte ich**, weil ich kein echtes iPhone habe:

- das Laden mit Sideloadly
- das Tippgefühl (Haptik)
- Mitteilungen auf dem Sperrbildschirm
- das echte Ablaufdatum unter „Gültig bis“

Das siehst du also als Erster. Fällt dir etwas auf, schick mir ein Bildschirmfoto.
