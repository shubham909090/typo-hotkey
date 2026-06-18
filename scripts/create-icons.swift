import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("assets", isDirectory: true)
try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)

func save(_ image: NSImage, to url: URL) throws {
    guard
        let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:])
    else {
        throw NSError(domain: "IconWriter", code: 1)
    }
    try png.write(to: url)
}

func color(_ hex: UInt32) -> NSColor {
    NSColor(
        calibratedRed: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: 1
    )
}

func roundedRect(_ rect: NSRect, radius: CGFloat, fill: NSColor, stroke: NSColor? = nil, lineWidth: CGFloat = 0) {
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    fill.setFill()
    path.fill()
    if let stroke {
        stroke.setStroke()
        path.lineWidth = lineWidth
        path.stroke()
    }
}

func drawText(_ text: String, in rect: NSRect, size: CGFloat, color: NSColor, weight: NSFont.Weight = .black) {
    let style = NSMutableParagraphStyle()
    style.alignment = .center
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color,
        .paragraphStyle: style,
    ]
    let attr = NSAttributedString(string: text, attributes: attributes)
    let textRect = NSRect(
        x: rect.minX,
        y: rect.midY - attr.size().height / 2,
        width: rect.width,
        height: attr.size().height
    )
    attr.draw(in: textRect)
}

func withTransform(center: NSPoint, angle degrees: CGFloat, body: () -> Void) {
    let transform = NSAffineTransform()
    transform.translateX(by: center.x, yBy: center.y)
    transform.rotate(byDegrees: degrees)
    transform.translateX(by: -center.x, yBy: -center.y)
    NSGraphicsContext.current?.saveGraphicsState()
    transform.concat()
    body()
    NSGraphicsContext.current?.restoreGraphicsState()
}

func drawLetterTile(_ letter: String, rect: NSRect, angle: CGFloat, fill: NSColor) {
    withTransform(center: NSPoint(x: rect.midX, y: rect.midY), angle: angle) {
        roundedRect(rect, radius: rect.width * 0.18, fill: fill, stroke: color(0x1c2530), lineWidth: rect.width * 0.035)
        drawText(letter, in: rect.insetBy(dx: 0, dy: rect.height * 0.04), size: rect.height * 0.58, color: .white)
    }
}

func drawHammer(scale: CGFloat, offsetX: CGFloat, offsetY: CGFloat) {
    let s = scale
    let handle = NSRect(x: offsetX + 412 * s, y: offsetY + 250 * s, width: 92 * s, height: 410 * s)
    withTransform(center: NSPoint(x: handle.midX, y: handle.midY), angle: -36) {
        roundedRect(handle, radius: 40 * s, fill: color(0xf6b34d), stroke: color(0x44271b), lineWidth: 16 * s)
        roundedRect(handle.insetBy(dx: 22 * s, dy: 22 * s), radius: 22 * s, fill: color(0xffd36f))
    }

    let head = NSRect(x: offsetX + 348 * s, y: offsetY + 585 * s, width: 330 * s, height: 170 * s)
    withTransform(center: NSPoint(x: head.midX, y: head.midY), angle: -18) {
        roundedRect(head, radius: 48 * s, fill: color(0x4a5568), stroke: color(0x111827), lineWidth: 18 * s)
        roundedRect(NSRect(x: head.minX + 36 * s, y: head.minY + 36 * s, width: head.width - 72 * s, height: head.height * 0.32), radius: 20 * s, fill: color(0x9aa8ba))
        roundedRect(NSRect(x: head.minX - 40 * s, y: head.minY + 32 * s, width: 85 * s, height: 108 * s), radius: 32 * s, fill: color(0x334155), stroke: color(0x111827), lineWidth: 12 * s)
        roundedRect(NSRect(x: head.maxX - 45 * s, y: head.minY + 32 * s, width: 85 * s, height: 108 * s), radius: 32 * s, fill: color(0x334155), stroke: color(0x111827), lineWidth: 12 * s)
    }
}

func drawBurst(center: NSPoint, radius: CGFloat) {
    let path = NSBezierPath()
    let points = 18
    for i in 0..<points {
        let angle = CGFloat(i) * .pi * 2 / CGFloat(points)
        let r = i.isMultiple(of: 2) ? radius : radius * 0.45
        let point = NSPoint(x: center.x + cos(angle) * r, y: center.y + sin(angle) * r)
        if i == 0 { path.move(to: point) } else { path.line(to: point) }
    }
    path.close()
    color(0xffdd4a).setFill()
    path.fill()
    color(0x111827).setStroke()
    path.lineWidth = radius * 0.08
    path.stroke()
}

func makeAppIcon() -> NSImage {
    let size: CGFloat = 1024
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    NSGraphicsContext.current?.imageInterpolation = .high

    roundedRect(NSRect(x: 0, y: 0, width: size, height: size), radius: 230, fill: color(0x0f172a))
    roundedRect(NSRect(x: 54, y: 54, width: size - 108, height: size - 108), radius: 190, fill: color(0x12b8a6))
    roundedRect(NSRect(x: 94, y: 94, width: size - 188, height: size - 188), radius: 160, fill: color(0x48e1d2))

    drawLetterTile("A", rect: NSRect(x: 154, y: 198, width: 180, height: 180), angle: 18, fill: color(0xef4444))
    drawLetterTile("Z", rect: NSRect(x: 690, y: 210, width: 160, height: 160), angle: -15, fill: color(0x7c3aed))
    drawLetterTile("B", rect: NSRect(x: 214, y: 640, width: 150, height: 150), angle: -23, fill: color(0xf97316))
    drawLetterTile("C", rect: NSRect(x: 674, y: 635, width: 155, height: 155), angle: 26, fill: color(0x2563eb))

    drawBurst(center: NSPoint(x: 520, y: 415), radius: 180)
    drawLetterTile("x", rect: NSRect(x: 422, y: 315, width: 190, height: 190), angle: -8, fill: color(0xfb7185))
    drawLetterTile("✓", rect: NSRect(x: 560, y: 370, width: 160, height: 160), angle: 10, fill: color(0x22c55e))
    drawHammer(scale: 1, offsetX: 0, offsetY: 0)

    image.unlockFocus()
    return image
}

func makeTrayIcon() -> NSImage {
    let size: CGFloat = 128
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    NSGraphicsContext.current?.imageInterpolation = .high
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: size, height: size).fill()
    drawBurst(center: NSPoint(x: 64, y: 48), radius: 27)
    drawLetterTile("A", rect: NSRect(x: 24, y: 26, width: 34, height: 34), angle: 12, fill: color(0xef4444))
    drawLetterTile("✓", rect: NSRect(x: 63, y: 31, width: 32, height: 32), angle: -10, fill: color(0x22c55e))
    drawHammer(scale: 0.13, offsetX: 4, offsetY: 18)
    image.unlockFocus()
    return image
}

try save(makeAppIcon(), to: assets.appendingPathComponent("icon.png"))
try save(makeTrayIcon(), to: assets.appendingPathComponent("tray-icon.png"))
print("wrote assets/icon.png assets/tray-icon.png")
