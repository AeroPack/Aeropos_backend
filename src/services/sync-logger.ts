export type LogLevel = "info" | "warn" | "error" | "debug";

export interface SyncLogEntry {
  timestamp: string;
  level: LogLevel;
  operation: string;
  table: string;
  uuid?: string;
  companyId?: number;
  requestId?: string;
  deviceId?: string;
  payload?: Record<string, unknown>;
  resolvedIds?: Record<string, number>;
  error?: string;
  errorCode?: string;
  errorField?: string;
}

export interface IncomingPayloadLog {
  table: string;
  uuid: string;
  data: Record<string, unknown>;
  companyId: number;
}

export interface ResolvedIdsLog {
  table: string;
  uuid: string;
  resolvedId: number;
}

export interface FailureLog {
  table: string;
  uuid?: string;
  error: string;
  errorCode: string;
  errorField?: string;
}

class SyncLogger {
  private formatEntry(entry: Omit<SyncLogEntry, "timestamp">): string {
    const logEntry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    return JSON.stringify(logEntry);
  }

  info(operation: string, table: string, data?: Partial<SyncLogEntry>) {
    console.log(this.formatEntry({ level: "info", operation, table, ...data }));
  }

  warn(operation: string, table: string, data?: Partial<SyncLogEntry>) {
    console.warn(this.formatEntry({ level: "warn", operation, table, ...data }));
  }

  error(operation: string, table: string, data?: Partial<SyncLogEntry>) {
    console.error(this.formatEntry({ level: "error", operation, table, ...data }));
  }

  debug(operation: string, table: string, data?: Partial<SyncLogEntry>) {
    console.debug(this.formatEntry({ level: "debug", operation, table, ...data }));
  }

  logIncomingPayload(log: IncomingPayloadLog) {
    this.info("INCOMING", log.table, {
      uuid: log.uuid,
      companyId: log.companyId,
      payload: log.data,
    });
  }

  logResolvedId(log: ResolvedIdsLog) {
    this.info("RESOLVED", log.table, {
      uuid: log.uuid,
      resolvedIds: { id: log.resolvedId },
    });
  }

  logFailure(log: FailureLog) {
    this.error("FAILURE", log.table, {
      uuid: log.uuid,
      error: log.error,
      errorCode: log.errorCode,
      errorField: log.errorField,
    });
  }

  logDeprecation(companyId: number, field: string) {
    this.warn("DEPRECATED", "middleware", {
      companyId,
      error: `Deprecated field used: ${field}`,
      errorCode: "DEPRECATED_FIELD",
      errorField: field,
    });
  }
}

export const syncLogger = new SyncLogger();

export function logSyncOperation(
  operation: "INCOMING" | "RESOLVED" | "SUCCESS" | "FAILURE" | "DEPRECATED",
  table: string,
  uuid: string | undefined,
  companyId: number,
  details?: Record<string, unknown>
) {
  const entry: SyncLogEntry = {
    timestamp: new Date().toISOString(),
    level: operation === "FAILURE" || operation === "DEPRECATED" ? "warn" : "info",
    operation,
    table,
    uuid,
    companyId,
    ...details,
  };

  const logLine = JSON.stringify(entry);

  if (operation === "FAILURE" || operation === "DEPRECATED") {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }
}

export function logIncoming(
  table: string,
  uuid: string,
  companyId: number,
  payload: Record<string, unknown>
) {
  logSyncOperation("INCOMING", table, uuid, companyId, { payload });
}

export function logResolved(
  table: string,
  uuid: string,
  companyId: number,
  resolvedId: number
) {
  logSyncOperation("RESOLVED", table, uuid, companyId, {
    resolvedIds: { id: resolvedId },
  });
}

export function logFailure(
  table: string,
  uuid: string | undefined,
  companyId: number,
  error: string,
  errorCode: string,
  errorField?: string
) {
  logSyncOperation("FAILURE", table, uuid, companyId, {
    error,
    errorCode,
    errorField,
  });
}

export function logDeprecation(
  table: string,
  uuid: string | undefined,
  companyId: number,
  field: string
) {
  logSyncOperation("DEPRECATED", table, uuid, companyId, {
    error: `Deprecated field used: ${field}`,
    errorCode: "DEPRECATED_FIELD",
    errorField: field,
  });
}