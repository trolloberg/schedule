import Foundation
import WebKit
import UniformTypeIdentifiers

/// Liefert die Dateien der Oberfläche aus dem Ordner `www` im App-Paket unter `app://schedule/…`.
/// Es gibt keinen Server und keinen Zugriff aufs Internet.
@MainActor
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {

    private let root: URL = (Bundle.main.resourceURL ?? Bundle.main.bundleURL)
        .appendingPathComponent("www", isDirectory: true).standardizedFileURL

    @objc(webView:startURLSchemeTask:)
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        // Nur Dateien innerhalb von www
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            respond(urlSchemeTask, url: url, status: 404, type: "text/plain; charset=utf-8", data: Data("Nicht gefunden".utf8))
            return
        }
        respond(urlSchemeTask, url: url, status: 200, type: mime(for: file.pathExtension), data: data)
    }

    @objc(webView:stopURLSchemeTask:)
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Antworten kommen sofort, es läuft nichts, das abgebrochen werden müsste
    }

    private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, type: String, data: Data) {
        let headers = [
            "Content-Type": type,
            "Content-Length": String(data.count),
            "Cache-Control": "no-store"
        ]
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(URLError(.badServerResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    private func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json; charset=utf-8"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        default: return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
