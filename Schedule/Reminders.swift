import Foundation
import UserNotifications

/// Erinnerungen als lokale Mitteilungen: Das iPhone meldet sich selbst, ohne Server und ohne Internet.
///
/// iOS hält höchstens 64 geplante Mitteilungen pro App. Die Oberfläche schickt deshalb bei jedem Öffnen und
/// nach jeder Änderung die nächsten Erinnerungen, und hier wird der alte Plan durch den neuen ersetzt.
final class Reminders: NSObject {

    static let shared = Reminders()

    struct Item {
        let time: Double      // Millisekunden seit 1970
        let id: String
        let title: String
        let body: String
    }

    /// Wird aufgerufen, wenn jemand eine Mitteilung antippt
    var onOpen: (() -> Void)?

    private let center = UNUserNotificationCenter.current()
    /// Ein Abgleich nach dem anderen: Der Plan wird immer ganz ersetzt, zwei gleichzeitige Abgleiche würden sich vermischen
    private let work = DispatchQueue(label: "schedule.reminders", qos: .userInitiated)
    private let prefix = "plan."
    private let hintId = "plan.hint"
    private let maxPlanned = 62

    // MARK: Plan übernehmen

    /// - Parameters:
    ///   - on: false löscht alle geplanten Erinnerungen
    ///   - ask: true fragt um Erlaubnis, falls noch nicht entschieden (nur direkt nach einem Tipp auf den Schalter)
    ///   - hint: Text einer letzten Mitteilung, die ans Öffnen der App erinnert, wenn nicht alles in den Plan passt
    func sync(on: Bool, ask: Bool, items: [Item], hint: String, done: @escaping @Sendable ([String: Any]) -> Void) {
        work.async {
            let gate = DispatchSemaphore(value: 0)
            self.run(on: on, ask: ask, items: items, hint: hint) { result in
                done(result)
                gate.signal()
            }
            // Nicht ewig warten: Bei der Frage um Erlaubnis kommt die Antwort erst, wenn getippt wurde
            _ = gate.wait(timeout: .now() + 15)
        }
    }

    private func run(on: Bool, ask: Bool, items: [Item], hint: String, done: @escaping @Sendable ([String: Any]) -> Void) {
        center.getNotificationSettings { settings in
            let status = settings.authorizationStatus
            guard on else {
                self.clear { self.reply(status, done) }
                return
            }
            switch status {
            case .notDetermined:
                guard ask else { self.reply(status, done); return }
                self.center.requestAuthorization(options: self.askOptions) { granted, _ in
                    if granted {
                        self.schedule(items, hint: hint) { self.report(done) }
                    } else {
                        self.report(done)
                    }
                }
            case .denied:
                self.clear { self.reply(status, done) }
            default:
                self.schedule(items, hint: hint) { self.report(done) }
            }
        }
    }

    /// Eine Mitteilung in fünf Sekunden, zum Ausprobieren
    func test(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        center.add(UNNotificationRequest(identifier: "test", content: content, trigger: trigger), withCompletionHandler: nil)
    }

    /// Schon gezeigte Mitteilungen aus der Mitteilungszentrale nehmen (die App ist ja jetzt offen)
    func clearDelivered() {
        center.removeAllDeliveredNotifications()
    }

    // MARK: Intern

    /// Was die App beim Fragen um Erlaubnis anfordert
    private var askOptions: UNAuthorizationOptions {
        var options: UNAuthorizationOptions = [.alert, .sound]
        #if DEBUG
        // Automatische Prüfung im Simulator: stille Erlaubnis ohne Rückfrage, damit das Planen geprüft werden kann
        if ProcessInfo.processInfo.environment["SCHEDULE_TEST_PROVISIONAL"] != nil { options.insert(.provisional) }
        #endif
        return options
    }

    private func plannedIds(_ requests: [UNNotificationRequest]) -> [String] {
        requests.map { $0.identifier }.filter { $0.hasPrefix(prefix) }
    }

    private func clear(_ then: @escaping () -> Void) {
        center.getPendingNotificationRequests { requests in
            self.center.removePendingNotificationRequests(withIdentifiers: self.plannedIds(requests))
            then()
        }
    }

    private func schedule(_ items: [Item], hint: String, then: @escaping () -> Void) {
        center.getPendingNotificationRequests { requests in
            self.center.removePendingNotificationRequests(withIdentifiers: self.plannedIds(requests))
            let now = Date().timeIntervalSince1970 * 1000
            let list = items.filter { $0.time > now + 3000 }.sorted { $0.time < $1.time }.prefix(self.maxPlanned)
            let group = DispatchGroup()
            let calendar = Calendar.current
            for item in list {
                let content = UNMutableNotificationContent()
                content.title = item.title
                content.body = item.body
                content.sound = .default
                content.threadIdentifier = item.id.hasPrefix("exp-") ? "ablauf" : "blocker"
                group.enter()
                self.center.add(self.request(self.prefix + item.id, content, at: item.time, calendar)) { _ in group.leave() }
            }
            // Passt nicht alles in den Plan: nach der letzten Erinnerung einmal ans Öffnen erinnern
            if !hint.isEmpty, let last = list.last(where: { !$0.id.hasPrefix("exp-") }) {
                let content = UNMutableNotificationContent()
                content.title = "Schedule"
                content.body = hint
                content.sound = .default
                content.threadIdentifier = "hinweis"
                group.enter()
                self.center.add(self.request(self.hintId, content, at: last.time + 60_000, calendar)) { _ in group.leave() }
            }
            group.notify(queue: .global(qos: .userInitiated)) { then() }
        }
    }

    /// Mitteilung zu einer festen Uhrzeit am Kalendertag (bleibt auch bei Zeitumstellung an der richtigen Stelle)
    private func request(_ id: String, _ content: UNNotificationContent, at time: Double, _ calendar: Calendar) -> UNNotificationRequest {
        let date = Date(timeIntervalSince1970: time / 1000)
        let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
        return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    }

    /// Stand nach dem Planen: Erlaubnis, Anzahl und Zeitpunkt der letzten geplanten Erinnerung
    private func report(_ done: @escaping @Sendable ([String: Any]) -> Void) {
        center.getNotificationSettings { settings in
            self.center.getPendingNotificationRequests { requests in
                var count = 0
                var until = 0.0
                for r in requests where r.identifier.hasPrefix(self.prefix) && r.identifier != self.hintId {
                    count += 1
                    if let t = (r.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() {
                        until = max(until, t.timeIntervalSince1970 * 1000)
                    }
                }
                var out = self.describe(settings.authorizationStatus)
                out["n"] = count
                out["until"] = until
                done(out)
            }
        }
    }

    private func reply(_ status: UNAuthorizationStatus, _ done: @escaping @Sendable ([String: Any]) -> Void) {
        var out = describe(status)
        out["n"] = 0
        out["until"] = 0
        done(out)
    }

    private func describe(_ status: UNAuthorizationStatus) -> [String: Any] {
        let name: String
        switch status {
        case .notDetermined: name = "notDetermined"
        case .denied: name = "denied"
        case .authorized: name = "authorized"
        case .provisional: name = "provisional"
        case .ephemeral: name = "ephemeral"
        @unknown default: name = "unknown"
        }
        let granted = status == .authorized || status == .provisional || status == .ephemeral
        return ["status": name, "granted": granted]
    }

}

// MARK: - UNUserNotificationCenterDelegate

extension Reminders: UNUserNotificationCenterDelegate {

    /// App ist offen: Mitteilung trotzdem als Banner mit Ton zeigen
    @objc(userNotificationCenter:willPresentNotification:withCompletionHandler:)
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    /// Mitteilung angetippt: die Heute-Ansicht zeigen
    @objc(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:)
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        DispatchQueue.main.async {
            self.onOpen?()
            completionHandler()
        }
    }
}
