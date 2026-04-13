/**
 * Simple logger utility for debugging email retry flow
 * Can be extended to send logs to a remote service
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const LOG_ENABLED = __DEV__ || process.env.NODE_ENV === "development";

function formatLog(entry: LogEntry): string {
  const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : "";
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}${dataStr}`;
}

function createLogEntry(level: LogLevel, context: string, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    context,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function createLogger(context: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (!LOG_ENABLED) return;
      const entry = createLogEntry("debug", context, message, data);
      console.log(formatLog(entry));
    },
    info(message: string, data?: Record<string, unknown>) {
      if (!LOG_ENABLED) return;
      const entry = createLogEntry("info", context, message, data);
      console.info(formatLog(entry));
    },
    warn(message: string, data?: Record<string, unknown>) {
      const entry = createLogEntry("warn", context, message, data);
      console.warn(formatLog(entry));
    },
    error(message: string, data?: Record<string, unknown>) {
      const entry = createLogEntry("error", context, message, data);
      console.error(formatLog(entry));
    },
  };
}

// Pre-configured loggers for different modules
export const emailRetryLogger = createLogger("EmailRetry");
export const cloudQueueLogger = createLogger("CloudQueue");
export const aiAnalysisLogger = createLogger("AIAnalysis");
