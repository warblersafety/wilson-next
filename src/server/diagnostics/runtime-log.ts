import { randomUUID } from "node:crypto";
import { operationIdHeader, runIdHeader } from "../../diagnostics/correlation";

export const diagnosticSchemaVersion = "wilson-runtime-diagnostic-v1";
export { operationIdHeader, runIdHeader } from "../../diagnostics/correlation";

const correlationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const credentialKeys = new Set([
  "authorization",
  "proxyauthorization",
  "cookie",
  "cookies",
  "setcookie",
  "password",
  "secret",
  "clientsecret",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "anthropicapikey",
  "anthropicauthtoken",
  "verceltoken",
  "environment",
  "environmentvalues",
  "env",
  "envvalues",
  "protectionbypass",
]);
const credentialValuePatterns = [
  /\bBearer\s+[^\s,;]+/gi,
  /\b(?:ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|ANTHROPIC_BASE_URL|VERCEL_TOKEN|COOKIE|AUTHORIZATION)\s*[=:]\s*[^\s,;]+/gi,
  /\bsk-ant-[A-Za-z0-9_-]+/g,
  /\b(?:vc|vcp)_[A-Za-z0-9_-]{12,}/g,
];

export interface DiagnosticContext {
  runId: string;
  operationId: string;
}

export type DiagnosticSource =
  | "browser"
  | "route"
  | "model"
  | "schema-domain"
  | "case-command"
  | "state-transition"
  | "response";

export type DiagnosticOutcome = "start" | "success" | "failure" | "rejected";

export interface RuntimeDiagnosticEvent {
  schemaVersion: typeof diagnosticSchemaVersion;
  timestamp: string;
  runId: string;
  operationId: string;
  sequence: number;
  source: DiagnosticSource;
  phase: string;
  outcome: DiagnosticOutcome;
  details?: unknown;
}

export type DiagnosticEventSink = (event: RuntimeDiagnosticEvent) => void;

export interface RuntimeDiagnosticLogger {
  readonly context: DiagnosticContext;
  event(source: DiagnosticSource, phase: string, outcome: DiagnosticOutcome, details?: unknown): void;
  checkpoint(phase: string, outcome: DiagnosticOutcome): void;
}

export function diagnosticContext(headers: Headers, createId: () => string = randomUUID): DiagnosticContext {
  return {
    runId: validCorrelationId(headers.get(runIdHeader)) ?? createId(),
    operationId: validCorrelationId(headers.get(operationIdHeader)) ?? createId(),
  };
}

export function createRuntimeDiagnosticLogger(
  context: DiagnosticContext,
  sink: DiagnosticEventSink = writeRuntimeEvent,
  now: () => Date = () => new Date(),
): RuntimeDiagnosticLogger {
  let sequence = 0;
  const trace: RuntimeDiagnosticEvent[] = [];

  const nextEvent = (
    source: DiagnosticSource,
    phase: string,
    outcome: DiagnosticOutcome,
    details?: unknown,
  ): RuntimeDiagnosticEvent => ({
    schemaVersion: diagnosticSchemaVersion,
    timestamp: now().toISOString(),
    runId: context.runId,
    operationId: context.operationId,
    sequence: ++sequence,
    source,
    phase,
    outcome,
    ...(details === undefined ? {} : { details: sanitizeDiagnosticValue(details) }),
  });

  return {
    context,
    event(source, phase, outcome, details) {
      const event = nextEvent(source, phase, outcome, details);
      trace.push(event);
      sink(event);
    },
    checkpoint(phase, outcome) {
      sink(nextEvent("response", phase, outcome, { events: trace }));
    },
  };
}

export function sanitizeDiagnosticValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") return redactCredentialStrings(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return String(value);
  if (value instanceof Error) return caughtErrorDetails(value, seen);
  if (Array.isArray(value)) return value.map((item) => sanitizeDiagnosticValue(item, seen));
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      sanitized[key] = isCredentialKey(key)
        ? "[REDACTED]"
        : sanitizeDiagnosticValue(item, seen);
    }
    seen.delete(value);
    return sanitized;
  }
  return String(value);
}

export function caughtErrorDetails(error: unknown, seen = new WeakSet<object>()): unknown {
  if (!(error instanceof Error)) return sanitizeDiagnosticValue(error, seen);
  if (seen.has(error)) return "[Circular]";
  seen.add(error);
  const details: Record<string, unknown> = {
    name: error.name,
    message: redactCredentialStrings(error.message),
  };
  if (error.stack) details.stack = redactCredentialStrings(error.stack);
  if (error.cause !== undefined) details.cause = sanitizeDiagnosticValue(error.cause, seen);
  for (const [key, item] of Object.entries(error)) {
    if (key in details) continue;
    details[key] = isCredentialKey(key)
      ? "[REDACTED]"
      : sanitizeDiagnosticValue(item, seen);
  }
  seen.delete(error);
  return details;
}

export const silentDiagnosticLogger: RuntimeDiagnosticLogger = {
  context: { runId: "00000000-0000-4000-8000-000000000000", operationId: "00000000-0000-4000-8000-000000000000" },
  event() {},
  checkpoint() {},
};

function validCorrelationId(value: string | null): string | undefined {
  return value && correlationIdPattern.test(value) ? value : undefined;
}

function redactCredentialStrings(value: string): string {
  return credentialValuePatterns.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, "[REDACTED]"),
    value,
  );
}

function isCredentialKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return credentialKeys.has(normalized)
    || normalized.endsWith("apikey")
    || normalized.endsWith("accesstoken")
    || normalized.endsWith("refreshtoken")
    || normalized.endsWith("password")
    || normalized.endsWith("secret");
}

function writeRuntimeEvent(event: RuntimeDiagnosticEvent): void {
  const serialized = JSON.stringify(event);
  if (event.outcome === "failure" || event.outcome === "rejected") {
    console.error(serialized);
  } else {
    console.log(serialized);
  }
}
