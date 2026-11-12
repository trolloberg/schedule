import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    private var controller: WebViewController? { window?.rootViewController as? WebViewController }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let look = Look.saved()
        let window = UIWindow(windowScene: windowScene)
        window.backgroundColor = look.background
        window.overrideUserInterfaceStyle = look.style
        window.rootViewController = WebViewController()
        self.window = window
        window.makeKeyAndVisible()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        controller?.appBecameActive()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Sicherstellen, dass der letzte Stand auf der Platte liegt, bevor iOS die App anhält
        DataStore.shared.flush()
    }
}
