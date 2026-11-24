import AppKit
import Foundation
import Vision

struct Arguments {
    let imagePath: String
    let expectedWidth: Int
    let expectedHeight: Int
    let requiredTokens: [String]
}

func usage() -> Never {
    fputs("usage: verify-ios-native-smoke <png> <width> <height> <token[,token...]>\n", stderr)
    exit(64)
}

let values = Array(CommandLine.arguments.dropFirst())
guard values.count == 4,
      let expectedWidth = Int(values[1]),
      let expectedHeight = Int(values[2]) else { usage() }

let arguments = Arguments(
    imagePath: values[0],
    expectedWidth: expectedWidth,
    expectedHeight: expectedHeight,
    requiredTokens: values[3].split(separator: ",").map { $0.lowercased() }
)

guard let image = NSImage(contentsOfFile: arguments.imagePath) else {
    fputs("unable to read screenshot: \(arguments.imagePath)\n", stderr)
    exit(1)
}

var proposedRect = NSRect(origin: .zero, size: image.size)
guard let cgImage = image.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil) else {
    fputs("unable to decode screenshot: \(arguments.imagePath)\n", stderr)
    exit(1)
}

let width = cgImage.width
let height = cgImage.height
guard width == arguments.expectedWidth, height == arguments.expectedHeight else {
    fputs("wrong screenshot dimensions: got \(width)x\(height), expected \(arguments.expectedWidth)x\(arguments.expectedHeight)\n", stderr)
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .fast
request.usesLanguageCorrection = true
request.recognitionLanguages = ["en-US"]
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    fputs("native screenshot OCR failed: \(error)\n", stderr)
    exit(1)
}

let recognized = (request.results ?? [])
    .compactMap { $0.topCandidates(1).first?.string }
    .joined(separator: " ")
    .lowercased()
let matched = arguments.requiredTokens.filter { recognized.contains($0) }

// A screenshot with source tokens is still a failure when the native app is
// visibly broken or the simulator has left an OS URL-confirmation prompt over
// it. Compacting OCR text catches both spaced and concatenated Vision output.
let compactRecognized = recognized.filter { $0.isLetter || $0.isNumber }
let forbiddenTokens = [
    "functioncallexception",
    "keychainexception",
    "securestore",
    "requiredentitlement",
    "entitlementisntpresent",
    "openinsealsend",
    "cancelopen",
]
let forbidden = forbiddenTokens.filter { compactRecognized.contains($0) }
guard forbidden.isEmpty else {
    fputs("native screenshot contains forbidden error/prompt OCR tokens: \(forbidden.joined(separator: ", ")); OCR was: \(recognized)\n", stderr)
    exit(1)
}

// Pixel dimensions alone can be satisfied by SpringBoard. Require two
// source-owned tokens so a live PID with a launch/splash screen is rejected.
guard matched.count >= 2 else {
    fputs("native app content not detected; OCR was: \(recognized)\n", stderr)
    exit(1)
}

let payload: [String: Any] = [
    "width": width,
    "height": height,
    "matchedTokens": matched,
    "forbiddenTokens": forbidden,
    "recognizedText": recognized
]
if let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
   let json = String(data: data, encoding: .utf8) {
    print(json)
}
