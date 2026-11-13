import UIKit

/// Feste Werte der Web-Oberfläche
enum Web {
    /// Eigenes Schema: Die Seite wird aus dem App-Paket geladen und hat immer dieselbe Herkunft (wichtig für den Web-Speicher).
    static let scheme = "app"
    static let host = "schedule"
    static let start = URL(string: "app://schedule/index.html")!
    /// Name der Brücke: window.webkit.messageHandlers.schedule
    static let bridge = "schedule"
}

/// Hell/Dunkel des letzten Starts, damit beim Öffnen nichts aufblitzt
struct Look {
    let background: UIColor
    let style: UIUserInterfaceStyle

    private static let keyTheme = "look.theme"

    static func saved() -> Look {
        make(theme: UserDefaults.standard.string(forKey: keyTheme) ?? "auto")
    }

    static func make(theme: String) -> Look {
        switch theme {
        case "dark": return Look(background: .black, style: .dark)
        case "light": return Look(background: UIColor(hex: "#f2f2f7") ?? .white, style: .light)
        default: return Look(background: UIColor(named: "LaunchBG") ?? .systemGroupedBackground, style: .unspecified)
        }
    }

    static func remember(theme: String) {
        UserDefaults.standard.set(theme, forKey: keyTheme)
    }
}

extension UIColor {
    /// Farbe aus "#rrggbb"
    convenience init?(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self.init(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255, blue: CGFloat(v & 0xff) / 255, alpha: 1)
    }
}

/// Kurzes Tippgefühl wie bei iOS-Schaltern
@MainActor
enum Haptics {
    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let medium = UIImpactFeedbackGenerator(style: .medium)
    private static let selection = UISelectionFeedbackGenerator()
    private static let notice = UINotificationFeedbackGenerator()

    static func play(_ kind: String) {
        switch kind {
        case "sel": selection.selectionChanged()
        case "light": light.impactOccurred()
        case "medium": medium.impactOccurred()
        case "ok": notice.notificationOccurred(.success)
        case "warn": notice.notificationOccurred(.warning)
        default: break
        }
    }
}

/// Angaben zur installierten App
enum AppInfo {
    static var version: String { Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "" }
    static var build: String { Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "" }

    /// Ablauf der Signatur. Mit kostenloser Apple-ID sind das 7 Tage nach dem Laden aufs iPhone,
    /// mit Entwicklerkonto ein Jahr. Im Simulator und ohne Profil gibt es keinen Ablauf.
    static let expiry: Date? = {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url)
        else { return nil }
        return expiryDate(inProfile: data)
    }()

    /// Liest das Ablaufdatum aus einem Bereitstellungsprofil. Das ist eine signierte Datei, in der eine lesbare Liste steckt.
    static func expiryDate(inProfile data: Data) -> Date? {
        guard let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), options: [], in: start.lowerBound..<data.endIndex)
        else { return nil }
        let xml = data.subdata(in: start.lowerBound..<end.upperBound)
        guard let plist = try? PropertyListSerialization.propertyList(from: xml, options: [], format: nil),
              let dict = plist as? [String: Any]
        else { return nil }
        return dict["ExpirationDate"] as? Date
    }
}

/// Protokoll für die automatische Prüfung im Simulator (nur in Debug-Builds)
enum TestLog {
    static func write(_ text: String) {
        #if DEBUG
        guard let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return }
        let file = dir.appendingPathComponent("test-log.txt")
        let line = Data((text + "\n").utf8)
        if let h = try? FileHandle(forWritingTo: file) {
            defer { try? h.close() }
            _ = try? h.seekToEnd()
            try? h.write(contentsOf: line)
        } else {
            try? line.write(to: file)
        }
        #endif
    }
}

#if DEBUG
/// Kleine Selbstprüfung für die automatische Prüfung im Simulator (nur in Debug-Builds)
enum SelfTest {
    static func run() {
        // Ablaufdatum: nachgebaute Profil-Datei mit Binärdaten vor und hinter der Liste, wie bei einer echten
        let xml = [
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
            "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
            "<plist version=\"1.0\">",
            "<dict>",
            "<key>AppIDName</key><string>Schedule</string>",
            "<key>ExpirationDate</key><date>2026-11-19T10:00:00Z</date>",
            "<key>TimeToLive</key><integer>7</integer>",
            "</dict>",
            "</plist>"
        ].joined(separator: "\n")
        var blob = Data([0x30, 0x82, 0x1f, 0x00, 0x06, 0x09, 0x2a, 0x86])
        blob.append(Data(xml.utf8))
        blob.append(Data([0xa0, 0x82, 0x0d, 0x00, 0xff, 0x00, 0x31, 0x82]))
        let seconds = AppInfo.expiryDate(inProfile: blob).map { Int($0.timeIntervalSince1970) } ?? -1
        let verdict = seconds == 1_795_082_400 ? "ok" : "FALSCH"
        TestLog.write("selftest expiry \(seconds) \(verdict)")
        TestLog.write("selftest files \(DataStore.shared.debugCounts())")
    }
}
#endif
