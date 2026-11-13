import Foundation

/// Zweite Kopie der Daten außerhalb des Web-Speichers.
///
/// - `Application Support/Schedule/daten.json`: der aktuelle Stand. Beim Start bekommt ihn die Oberfläche mit
///   und nimmt ihn, falls der Web-Speicher leer oder älter ist.
/// - `Documents/Sicherungen/schedule-JJJJ-MM-TT.json`: eine Sicherung pro Tag (die letzten 14). Der Ordner ist in
///   der Dateien-App unter „Auf meinem iPhone › Schedule“ sichtbar. Jede Datei lässt sich über „Backup laden“ einlesen.
///
/// Der Inhalt ist immer der Text, den die Oberfläche schickt: `{"app":"schedule","version":…,"mod":…,"data":{…}}`.
final class DataStore {

    static let shared = DataStore()

    private let fm = FileManager.default
    private let queue = DispatchQueue(label: "schedule.datastore", qos: .userInitiated)
    private let keepDays = 14
    private let keepBefore = 3

    let supportDir: URL
    let backupDir: URL
    private var mirror: URL { supportDir.appendingPathComponent("daten.json") }

    private init() {
        let files = FileManager.default
        let support = files.urls(for: .applicationSupportDirectory, in: .userDomainMask).first ?? files.temporaryDirectory
        let docs = files.urls(for: .documentDirectory, in: .userDomainMask).first ?? files.temporaryDirectory
        let supportDir = support.appendingPathComponent("Schedule", isDirectory: true)
        let backupDir = docs.appendingPathComponent("Sicherungen", isDirectory: true)
        self.supportDir = supportDir
        self.backupDir = backupDir
        try? files.createDirectory(at: supportDir, withIntermediateDirectories: true)
        try? files.createDirectory(at: backupDir, withIntermediateDirectories: true)
    }

    // MARK: Lesen

    /// Letzter gespeicherter Stand. Ist die Hauptkopie nicht lesbar, die jüngste Tagessicherung.
    func loadEnvelope() -> String? {
        queue.sync { () -> String? in
            if let text = read(mirror) { return text }
            for file in dailyFiles().reversed() {
                if let text = read(file) { return text }
            }
            return nil
        }
    }

    private func read(_ url: URL) -> String? {
        guard let data = try? Data(contentsOf: url), !data.isEmpty,
              let obj = try? JSONSerialization.jsonObject(with: data),
              let dict = obj as? [String: Any], dict["data"] is [String: Any],
              let text = String(data: data, encoding: .utf8)
        else { return nil }
        return text
    }

    // MARK: Schreiben

    /// Neuen Stand ablegen. Läuft im Hintergrund, die Oberfläche wartet nicht darauf.
    func save(envelope: String) {
        guard envelope.hasPrefix("{"), envelope.utf8.count < 20_000_000 else { return }
        queue.async { self.write(envelope) }
    }

    /// Wartet, bis alle offenen Schreibvorgänge fertig sind (beim Wechsel in den Hintergrund).
    func flush() {
        queue.sync { }
    }

    private func write(_ envelope: String) {
        let data = Data(envelope.utf8)
        // Wird der Stand plötzlich viel kleiner (alles gelöscht, anderes Backup geladen), den alten Stand aufheben
        if let old = try? Data(contentsOf: mirror), old.count >= 2_000, data.count * 2 < old.count {
            let name = "schedule-\(stamp("yyyy-MM-dd-HHmm"))-vorher.json"
            try? old.write(to: backupDir.appendingPathComponent(name), options: .atomic)
        }
        do {
            try data.write(to: mirror, options: .atomic)
        } catch {
            try? fm.createDirectory(at: supportDir, withIntermediateDirectories: true)
            try? data.write(to: mirror, options: .atomic)
        }
        let daily = backupDir.appendingPathComponent("schedule-\(stamp("yyyy-MM-dd")).json")
        do {
            try data.write(to: daily, options: .atomic)
        } catch {
            try? fm.createDirectory(at: backupDir, withIntermediateDirectories: true)
            try? data.write(to: daily, options: .atomic)
        }
        prune()
    }

    private func stamp(_ format: String) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = format
        return f.string(from: Date())
    }

    /// Dateien im Sicherungsordner, deren Name genau auf das Muster passt, älteste zuerst.
    /// Alles andere (zum Beispiel ein Backup, das du selbst dort abgelegt hast) bleibt unberührt.
    private func files(matching pattern: String) -> [URL] {
        let all = (try? fm.contentsOfDirectory(at: backupDir, includingPropertiesForKeys: nil)) ?? []
        return all.filter { $0.lastPathComponent.range(of: pattern, options: .regularExpression) != nil }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    /// Tagessicherungen: schedule-JJJJ-MM-TT.json
    private func dailyFiles() -> [URL] {
        files(matching: "^schedule-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json$")
    }

    /// Stände von vor einer großen Änderung: schedule-JJJJ-MM-TT-HHMM-vorher.json
    private func beforeFiles() -> [URL] {
        files(matching: "^schedule-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}-vorher\\.json$")
    }

    private func prune() {
        for old in dailyFiles().dropLast(keepDays) { try? fm.removeItem(at: old) }
        for old in beforeFiles().dropLast(keepBefore) { try? fm.removeItem(at: old) }
    }

    #if DEBUG
    /// Für die automatische Prüfung: wie viele Sicherungen erkannt werden
    func debugCounts() -> String {
        queue.sync { () -> String in
            "daily=\(self.dailyFiles().count) before=\(self.beforeFiles().count)"
        }
    }
    #endif

    // MARK: Aufräumen

    /// Backups, die fürs Teilen im temporären Ordner lagen, beim Start entfernen
    func cleanTemp() {
        queue.async {
            let tmp = self.fm.temporaryDirectory
            let files = (try? self.fm.contentsOfDirectory(at: tmp, includingPropertiesForKeys: nil)) ?? []
            for f in files where f.lastPathComponent.hasPrefix("schedule-backup-") { try? self.fm.removeItem(at: f) }
        }
    }
}
