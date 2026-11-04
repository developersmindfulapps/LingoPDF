export type LogLevel = "info" | "warn" | "error" | "security";

const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|cookie|authorization|api[-_]?key|credential|session|private[-_]?key|signature/i;

const REDACTED_VALUE = "[REDACTED]";

/**
 * Recursively sanitizes a value for structured server logging, redacting
 * credentials, tokens, cookies, passwords, and formatting Error instances safely.
 */
export function sanitizeLogMeta(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[MAX_DEPTH]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Error) {
    const errRecord: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };
    if ("code" in value && (typeof value.code === "string" || typeof value.code === "number")) {
      errRecord.code = value.code;
    }
    return errRecord;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogMeta(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = REDACTED_VALUE;
      } else {
        sanitized[key] = sanitizeLogMeta(val, depth + 1);
      }
    }
    return sanitized;
  }

  return value;
}

function emitLog(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event,
  };

  if (meta && Object.keys(meta).length > 0) {
    payload.context = sanitizeLogMeta(meta);
  }

  const serialized = JSON.stringify(payload);

  if (level === "error" || level === "security") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export const logger = {
  info(event: string, meta?: Record<string, unknown>): void {
    emitLog("info", event, meta);
  },
  warn(event: string, meta?: Record<string, unknown>): void {
    emitLog("warn", event, meta);
  },
  error(event: string, meta?: Record<string, unknown>): void {
    emitLog("error", event, meta);
  },
  security(event: string, meta?: Record<string, unknown>): void {
    emitLog("security", event, meta);
  },
};
