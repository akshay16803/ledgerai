import os

enum AppLogger {
    private static let subsystem = "com.spentyai"

    static let networking = Logger(subsystem: subsystem, category: "networking")
    static let auth = Logger(subsystem: subsystem, category: "auth")
    static let storekit = Logger(subsystem: subsystem, category: "storekit")
    static let ui = Logger(subsystem: subsystem, category: "ui")
    static let general = Logger(subsystem: subsystem, category: "general")
}
