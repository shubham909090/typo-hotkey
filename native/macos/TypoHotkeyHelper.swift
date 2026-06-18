import AppKit
import ApplicationServices
import Foundation

enum HelperError: Error, CustomStringConvertible {
    case missingFocusedElement
    case unsupportedTextElement
    case invalidParams(String)
    case accessibilityWriteFailed(AXError)

    var description: String {
        switch self {
        case .missingFocusedElement:
            return "No focused accessibility element."
        case .unsupportedTextElement:
            return "Focused element does not expose editable text."
        case .invalidParams(let message):
            return message
        case .accessibilityWriteFailed(let error):
            return "Failed to write focused text: \(error.rawValue)."
        }
    }
}

func send(_ object: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(object),
          let data = try? JSONSerialization.data(withJSONObject: object, options: []),
          let line = String(data: data, encoding: .utf8)
    else {
        return
    }

    print(line)
    fflush(stdout)
}

func ok(id: Any, result: Any) {
    send(["id": id, "ok": true, "result": result])
}

func fail(id: Any?, error: String) {
    send(["id": id ?? NSNull(), "ok": false, "error": error])
}

func params(from request: [String: Any]) -> [String: Any] {
    return request["params"] as? [String: Any] ?? [:]
}

func accessibilityStatus(_ params: [String: Any]) -> [String: Any] {
    let prompt = params["prompt"] as? Bool ?? false
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary
    return ["trusted": AXIsProcessTrustedWithOptions(options)]
}

func focusedElement() throws -> AXUIElement {
    let systemWide = AXUIElementCreateSystemWide()
    AXUIElementSetMessagingTimeout(systemWide, 5.0)

    var value: CFTypeRef?
    let directError = AXUIElementCopyAttributeValue(systemWide, kAXFocusedUIElementAttribute as CFString, &value)
    if directError == .success, let element = value {
        return (element as! AXUIElement)
    }

    var appValue: CFTypeRef?
    let appError = AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplicationAttribute as CFString, &appValue)
    if appError == .success, let focusedApp = appValue {
        var appFocusedValue: CFTypeRef?
        let appFocusedError = AXUIElementCopyAttributeValue(
            (focusedApp as! AXUIElement),
            kAXFocusedUIElementAttribute as CFString,
            &appFocusedValue
        )

        if appFocusedError == .success, let element = appFocusedValue {
            return (element as! AXUIElement)
        }
    }

    if let frontmostApplication = NSWorkspace.shared.frontmostApplication {
        let appElement = AXUIElementCreateApplication(frontmostApplication.processIdentifier)
        AXUIElementSetMessagingTimeout(appElement, 5.0)
        var appFocusedValue: CFTypeRef?
        let appFocusedError = AXUIElementCopyAttributeValue(
            appElement,
            kAXFocusedUIElementAttribute as CFString,
            &appFocusedValue
        )

        if appFocusedError == .success, let element = appFocusedValue {
            return (element as! AXUIElement)
        }
    }

    throw HelperError.missingFocusedElement
}

func copyAttribute(_ element: AXUIElement, _ attribute: String) -> CFTypeRef? {
    var value: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    guard error == .success else {
        return nil
    }

    return value
}

func stringAttribute(_ element: AXUIElement, _ attribute: String) -> String? {
    return copyAttribute(element, attribute) as? String
}

func isSecureField(_ element: AXUIElement) -> Bool {
    let role = stringAttribute(element, kAXRoleAttribute)
    let subrole = stringAttribute(element, kAXSubroleAttribute)
    return role == "AXSecureTextField" || subrole == "AXSecureTextField"
}

func selectedRange(_ element: AXUIElement) -> [String: Int]? {
    guard let value = copyAttribute(element, kAXSelectedTextRangeAttribute),
          CFGetTypeID(value) == AXValueGetTypeID()
    else {
        return nil
    }

    let axValue = value as! AXValue
    guard AXValueGetType(axValue) == .cfRange else {
        return nil
    }

    var range = CFRange()
    guard AXValueGetValue(axValue, .cfRange, &range) else {
        return nil
    }

    return ["location": range.location, "length": range.length]
}

func readFocusedText() throws -> Any {
    let element = try focusedElement()
    if isSecureField(element) {
        return ["text": "", "secure": true]
    }

    guard let value = copyAttribute(element, kAXValueAttribute) else {
        return NSNull()
    }

    guard let text = value as? String else {
        throw HelperError.unsupportedTextElement
    }

    var result: [String: Any] = ["text": text, "secure": false]
    if let selection = selectedRange(element) {
        result["selection"] = selection
    }

    return result
}

func writeFocusedText(_ params: [String: Any]) throws -> [String: Bool] {
    guard let text = params["text"] as? String else {
        throw HelperError.invalidParams("writeFocusedText requires text.")
    }

    let element = try focusedElement()
    let error = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, text as CFTypeRef)
    guard error == .success else {
        throw HelperError.accessibilityWriteFailed(error)
    }

    if let selection = params["selection"] as? [String: Any],
       let location = selection["location"] as? Int,
       let length = selection["length"] as? Int {
        var range = CFRange(location: location, length: length)
        if let value = AXValueCreate(.cfRange, &range) {
            _ = AXUIElementSetAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, value)
        }
    }

    return ["written": true]
}

func suggestWords(_ params: [String: Any]) throws -> [String: Any] {
    guard let words = params["words"] as? [String] else {
        throw HelperError.invalidParams("suggestWords requires words.")
    }

    let language = params["language"] as? String
    let correctionLanguage = language ?? "en"
    let checker = NSSpellChecker.shared
    var result: [String: Any] = [:]

    for word in words {
        var wordCount = 0
        let misspelledRange = checker.checkSpelling(
            of: word,
            startingAt: 0,
            language: language,
            wrap: false,
            inSpellDocumentWithTag: 0,
            wordCount: &wordCount
        )

        if misspelledRange.location == NSNotFound {
            result[word] = NSNull()
            continue
        }

        if let correction = checker.correction(
            forWordRange: misspelledRange,
            in: word,
            language: correctionLanguage,
            inSpellDocumentWithTag: 0
        ), !correction.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines).isEmpty {
            result[word] = correction
            continue
        }

        let guesses = checker.guesses(
            forWordRange: misspelledRange,
            in: word,
            language: language,
            inSpellDocumentWithTag: 0
        )

        result[word] = guesses?.first ?? NSNull()
    }

    return result
}

func handle(_ request: [String: Any]) throws -> Any {
    let method = request["method"] as? String ?? ""
    let requestParams = params(from: request)

    switch method {
    case "accessibilityStatus":
        return accessibilityStatus(requestParams)
    case "readFocusedText":
        return try readFocusedText()
    case "writeFocusedText":
        return try writeFocusedText(requestParams)
    case "suggestWords":
        return try suggestWords(requestParams)
    default:
        throw HelperError.invalidParams("Unknown method: \(method).")
    }
}

while let line = readLine(strippingNewline: true) {
    guard let data = line.data(using: .utf8),
          let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
        fail(id: nil, error: "Invalid JSON request.")
        continue
    }

    let id = request["id"] ?? NSNull()

    do {
        let result = try handle(request)
        ok(id: id, result: result)
    } catch {
        fail(id: id, error: String(describing: error))
    }
}
