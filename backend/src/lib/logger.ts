interface LogPayload {
  [key: string]: unknown;
}

function formatPayload(payload?: LogPayload): LogPayload | undefined {
  if (!payload) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return payload;
  }
}

export const logger = {
  info(payload: LogPayload, message: string) {
    console.info(message, formatPayload(payload));
  },
  warn(payload: LogPayload, message: string) {
    console.warn(message, formatPayload(payload));
  },
  error(payload: LogPayload, message: string) {
    console.error(message, formatPayload(payload));
  }
};
