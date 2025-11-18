type LogData = Record<string, unknown> | undefined;

function formatScope(scope: string) {
  return scope ? `[${scope}]` : "";
}

export function maskEmail(email?: string | null) {
  if (!email) {
    return null;
  }

  const [localPart, domain = ""] = email.split("@");
  const trimmedLocal = localPart.trim();

  if (!trimmedLocal) {
    return `***${domain ? `@${domain}` : ""}`;
  }

  const visible =
    trimmedLocal.length <= 3 ? trimmedLocal : trimmedLocal.slice(0, 3);
  const maskedLocal = `${visible}***`;

  return `${maskedLocal}${domain ? `@${domain}` : ""}`;
}

export function logInfo(scope: string, message: string, data?: LogData) {
  if (data) {
    console.info(`${formatScope(scope)} ${message}`, data);
    return;
  }

  console.info(`${formatScope(scope)} ${message}`);
}

export function logError(scope: string, message: string, data?: LogData) {
  if (data) {
    console.error(`${formatScope(scope)} ${message}`, data);
    return;
  }

  console.error(`${formatScope(scope)} ${message}`);
}
