import UIKit
import UserNotifications

/// Schedule als iPhone-App: eine schlanke Hülle um die Oberfläche in `www/index.html`.
/// Alles liegt im App-Paket und läuft ohne Internet.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // Mitteilungen auch zeigen, wenn die App offen ist, und auf Tipps darauf reagieren
        UNUserNotificationCenter.current().delegate = Reminders.shared
        DataStore.shared.cleanTemp()
        #if DEBUG
        SelfTest.run()
        #endif
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
