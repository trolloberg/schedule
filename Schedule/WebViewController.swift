import UIKit
import WebKit

/// Zeigt die Oberfläche (`www/index.html`) bildschirmfüllend und verbindet sie mit dem iPhone:
/// Datenkopie, Erinnerungen, Teilen-Menü, Statusleiste und Tippgefühl.
final class WebViewController: UIViewController {

    private var webView: WKWebView!
    private var ready = false            // Die Oberfläche hat sich gemeldet
    private var everReady = false
    private var attempts = 0
    private var openDayWhenReady = false // Eine Mitteilung wurde angetippt, bevor die Oberfläche stand
    private var lightStatusBar: Bool?    // nil: iOS entscheidet nach Hell/Dunkel

    // MARK: Aussehen

    override var preferredStatusBarStyle: UIStatusBarStyle {
        guard let light = lightStatusBar else { return .default }
        return light ? .lightContent : .darkContent
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    // MARK: Aufbau

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Look.saved().background

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: Web.scheme)
        config.userContentController.add(WeakMessageHandler(self), name: Web.bridge)
        config.dataDetectorTypes = []
        config.allowsInlineMediaPlayback = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = false

        let web = WKWebView(frame: view.bounds, configuration: config)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        // Durchsichtig, bis die Seite gezeichnet ist: So sieht man nur die Hintergrundfarbe, nie eine weiße Fläche
        web.isOpaque = false
        web.backgroundColor = .clear
        web.alpha = 0
        web.navigationDelegate = self
        web.allowsLinkPreview = false
        web.allowsBackForwardNavigationGestures = false
        let scroll = web.scrollView
        scroll.backgroundColor = .clear
        scroll.contentInsetAdjustmentBehavior = .never   // Die Seite kümmert sich selbst um Dynamic Island und Home-Balken
        scroll.bounces = false
        scroll.alwaysBounceVertical = false
        scroll.alwaysBounceHorizontal = false
        scroll.showsVerticalScrollIndicator = false
        scroll.showsHorizontalScrollIndicator = false
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = 1
        scroll.pinchGestureRecognizer?.isEnabled = false
        scroll.delegate = self
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        view.addSubview(web)
        webView = web

        Reminders.shared.onOpen = { [weak self] in self?.openDay() }
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(keyboardDidHide), name: UIResponder.keyboardDidHideNotification, object: nil)
        center.addObserver(self, selector: #selector(timeChanged), name: UIApplication.significantTimeChangeNotification, object: nil)

        loadApp()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // Kein Anheben und Ziehen von Bildern wie in Safari
        for sub in webView.scrollView.subviews {
            for interaction in sub.interactions where interaction is UIDragInteraction {
                sub.removeInteraction(interaction)
            }
        }
    }

    // MARK: Laden

    /// Oberfläche (neu) laden. Der letzte gespeicherte Stand wird vor dem ersten Skript der Seite bereitgestellt.
    private func loadApp() {
        ready = false
        attempts += 1
        let scripts = webView.configuration.userContentController
        scripts.removeAllUserScripts()
        scripts.addUserScript(WKUserScript(source: bootSource(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView.load(URLRequest(url: Web.start))
        let attempt = attempts
        // Spätestens nach kurzer Zeit zeigen, auch wenn sich die Seite nicht meldet
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.reveal() }
        // Meldet sie sich gar nicht, einmal neu versuchen (die Seite zeigt sonst selbst einen Knopf „Neu laden“)
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self = self, !self.ready, self.attempts == attempt, attempt < 3 else { return }
            TestLog.write("watchdog reload \(attempt)")
            self.loadApp()
        }
    }

    private func bootSource() -> String {
        var info: [String: Any] = [
            "version": AppInfo.version,
            "build": AppInfo.build,
            "lang": Locale.preferredLanguages.first ?? "de",
            "ios": UIDevice.current.systemVersion
        ]
        if let expiry = AppInfo.expiry {
            info["exp"] = (expiry.timeIntervalSince1970 * 1000).rounded()
        }
        var boot: [String: Any] = ["info": info]
        if let envelope = DataStore.shared.loadEnvelope() {
            boot["env"] = envelope
        }
        guard let data = try? JSONSerialization.data(withJSONObject: boot),
              let json = String(data: data, encoding: .utf8)
        else { return "window.__nativeBoot = {info:{}};" }
        return "window.__nativeBoot = \(json);"
    }

    private func reveal() {
        guard webView.alpha < 1 else { return }
        UIView.animate(withDuration: 0.18) { self.webView.alpha = 1 }
    }

    // MARK: App-Zustand

    /// Die App ist wieder vorn: Oberfläche auffrischen und Erinnerungen nachlegen lassen
    func appBecameActive() {
        Reminders.shared.clearDelivered()
        guard everReady else { return }
        webView.evaluateJavaScript("window.__nativeResume ? (window.__nativeResume(), 1) : 0") { [weak self] result, error in
            guard let self = self, self.ready else { return }
            // Hat iOS die Web-Ansicht im Hintergrund beendet, ist die Seite leer: neu laden
            if error != nil || (result as? NSNumber)?.intValue != 1 {
                TestLog.write("resume reload")
                self.attempts = 0
                self.loadApp()
            }
        }
    }

    @objc private func timeChanged() {
        guard ready else { return }
        webView.evaluateJavaScript("window.__nativeResume && window.__nativeResume()", completionHandler: nil)
    }

    @objc private func keyboardDidHide() {
        // Nach dem Schließen der Tastatur steht die Seite sonst manchmal verschoben
        let scroll = webView.scrollView
        if scroll.contentOffset != .zero { scroll.setContentOffset(.zero, animated: false) }
    }

    private func openDay() {
        guard ready else { openDayWhenReady = true; return }
        webView.evaluateJavaScript("window.__nativeGo && window.__nativeGo('day')", completionHandler: nil)
    }

    // MARK: Aufrufe in die Oberfläche

    /// Ruft `window.<name>(<wert>)` auf. Der Wert wird als JSON übergeben, nie als zusammengesetzter Text.
    private func call(_ name: String, _ value: Any) {
        guard JSONSerialization.isValidJSONObject([value]),
              let data = try? JSONSerialization.data(withJSONObject: [value]),
              let json = String(data: data, encoding: .utf8)
        else { return }
        let argument = json.dropFirst().dropLast()   // [wert] -> wert
        webView.evaluateJavaScript("window.\(name) && window.\(name)(\(argument))", completionHandler: nil)
    }

    // MARK: Nachrichten der Oberfläche

    fileprivate func handle(_ body: [String: Any]) {
        guard let type = body["t"] as? String else { return }
        switch type {
        case "ready":
            ready = true
            everReady = true
            attempts = 0
            reveal()
            TestLog.write("ready \(body["v"] as? String ?? "?")")
            if openDayWhenReady { openDayWhenReady = false; openDay() }
            runTestScript()

        case "save":
            if let envelope = body["env"] as? String { DataStore.shared.save(envelope: envelope) }

        case "bar":
            applyBar(background: body["bg"] as? String, light: flag(body["light"]), theme: body["theme"] as? String ?? "auto")

        case "haptic":
            Haptics.play(body["k"] as? String ?? "")

        case "notify":
            syncReminders(body)

        case "notifyTest":
            Reminders.shared.test(title: body["title"] as? String ?? "Schedule", body: body["body"] as? String ?? "")

        case "export":
            exportBackup(name: body["name"] as? String ?? "schedule-backup.json", text: body["text"] as? String ?? "")

        case "copy":
            UIPasteboard.general.string = body["text"] as? String ?? ""

        case "settings":
            if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }

        case "backups":
            openBackups()

        case "reload":
            attempts = 0
            loadApp()

        case "log":
            TestLog.write("js \(body["m"] as? String ?? "")")

        default:
            break
        }
    }

    private func flag(_ value: Any?) -> Bool {
        if let b = value as? Bool { return b }
        if let n = value as? NSNumber { return n.intValue != 0 }
        return false
    }

    /// Hintergrund hinter der Seite und Schriftfarbe der Statusleiste. In „Heute“ ist das die Farbe des laufenden Blockers.
    private func applyBar(background: String?, light: Bool, theme: String) {
        Look.remember(theme: theme)
        let look = Look.make(theme: theme)
        view.window?.overrideUserInterfaceStyle = look.style
        let color = background.flatMap { UIColor(hex: $0) } ?? look.background
        view.backgroundColor = color
        view.window?.backgroundColor = color
        if lightStatusBar != light {
            lightStatusBar = light
            UIView.animate(withDuration: 0.2) { self.setNeedsStatusBarAppearanceUpdate() }
        }
    }

    private func syncReminders(_ body: [String: Any]) {
        let rid = (body["rid"] as? NSNumber)?.intValue ?? 0
        var items: [Reminders.Item] = []
        for raw in (body["plan"] as? [[String: Any]]) ?? [] {
            guard let time = (raw["t"] as? NSNumber)?.doubleValue, let id = raw["id"] as? String, !id.isEmpty else { continue }
            items.append(Reminders.Item(time: time, id: id, title: raw["title"] as? String ?? "Schedule", body: raw["body"] as? String ?? ""))
        }
        Reminders.shared.sync(on: flag(body["on"]), ask: flag(body["ask"]), items: items, hint: body["hint"] as? String ?? "") { [weak self] result in
            let out = result.merging(["rid": rid]) { _, new in new }
            let note = "notify \(out["status"] as? String ?? "?") n=\((out["n"] as? Int) ?? 0)"
            DispatchQueue.main.async { [weak self] in
                TestLog.write(note)
                self?.call("__nativeNotify", out)
            }
        }
    }

    /// Backup über das Teilen-Menü von iOS weitergeben (In Dateien sichern, AirDrop, Mail …)
    private func exportBackup(name: String, text: String) {
        var safe = name.replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "_", options: .regularExpression)
        if !safe.hasPrefix("schedule-backup-") { safe = "schedule-backup-" + safe }
        if !safe.hasSuffix(".json") { safe += ".json" }
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
        do {
            try Data(text.utf8).write(to: file, options: .atomic)
        } catch {
            call("__nativeExported", false)
            return
        }
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        sheet.completionWithItemsHandler = { [weak self] _, completed, _, _ in
            self?.call("__nativeExported", completed)
        }
        if let pop = sheet.popoverPresentationController {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        }
        present(sheet, animated: true)
    }

    /// Ordner mit den täglichen Sicherungen in der Dateien-App öffnen
    private func openBackups() {
        let path = DataStore.shared.backupDir.path
        let encoded = path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path
        guard let url = URL(string: "shareddocuments://" + encoded) else {
            call("__nativeBackups", false)
            return
        }
        UIApplication.shared.open(url, options: [:]) { [weak self] ok in
            if !ok { self?.call("__nativeBackups", false) }
        }
    }

    /// Automatische Prüfung im Simulator: Ein Skript aus der Umgebung ausführen (nur in Debug-Builds)
    private func runTestScript() {
        #if DEBUG
        guard let script = ProcessInfo.processInfo.environment["SCHEDULE_TEST_JS"], !script.isEmpty else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            self?.webView.evaluateJavaScript(script) { _, error in
                if let error = error { TestLog.write("test error \(error.localizedDescription)") }
            }
        }
        #endif
    }
}

// MARK: - Brücke

/// Hält den Controller nur schwach, damit kein Kreis aus Verweisen entsteht
@MainActor
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {

    private weak var target: WebViewController?

    init(_ target: WebViewController) {
        self.target = target
        super.init()
    }

    @objc(userContentController:didReceiveScriptMessage:)
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Nur die eigene Seite aus dem App-Paket darf die Brücke benutzen
        guard message.name == Web.bridge,
              message.frameInfo.isMainFrame,
              message.webView?.url?.scheme == Web.scheme,
              let body = message.body as? [String: Any]
        else { return }
        target?.handle(body)
    }
}

// MARK: - Navigation

extension WebViewController: WKNavigationDelegate {

    /// Die App zeigt nur ihre eigene Seite. Links nach draußen öffnen sich in Safari.
    @objc(webView:decidePolicyForNavigationAction:decisionHandler:)
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let scheme = (url.scheme ?? "").lowercased()
        if scheme == Web.scheme || scheme == "about" || scheme == "blob" {
            decisionHandler(.allow)
            return
        }
        if ["http", "https", "mailto", "tel"].contains(scheme), navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        reveal()
    }

    /// iOS hat den Web-Prozess beendet (zum Beispiel bei wenig Speicher): neu laden, die Daten sind gesichert
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        TestLog.write("process terminated")
        attempts = 0
        loadApp()
    }
}

// MARK: - Kein Zoomen

extension WebViewController: UIScrollViewDelegate {

    func scrollViewWillBeginZooming(_ scrollView: UIScrollView, with view: UIView?) {
        scrollView.pinchGestureRecognizer?.isEnabled = false
    }
}
