// Contract for the Results API. Shared by the Worker (validation, responses) and the UI (rendering).
// The qa-tests reporter sends these shapes; keep changes backwards compatible.

export const RUN_STATUSES = ["running", "passed", "failed"] as const;
export const TEST_STATUSES = ["passed", "failed", "healed", "skipped"] as const;
export const TRIGGERS = ["deploy", "manual"] as const;

export type StoredRunStatus = (typeof RUN_STATUSES)[number];
// "incomplete" is derived on read: a run left "running" for too long (for example, a cancelled CI job).
export type RunStatus = StoredRunStatus | "incomplete";
export type TestStatus = (typeof TEST_STATUSES)[number];
export type RunTrigger = (typeof TRIGGERS)[number];

export const LIMITS = {
  text: 300,
  message: 4_000,
  stack: 8_000,
  steps: 100,
  logs: 200,
  logLine: 1_000,
  screenshotBytes: 200 * 1024,
  bodyBytes: 512 * 1024,
  runsPerPage: 50,
  abandonAfterMs: 30 * 60 * 1000,
} as const;

export interface Healing {
  element: string;
  broken: string;
  used: string;
  suggestion: string;
}

export interface TestStep {
  title: string;
  durationMs: number;
  failed?: boolean;
}

export interface RunStartInput {
  project: string;
  trigger: RunTrigger;
  targetUrl: string;
  commitSha?: string;
  commitMessage?: string;
  ciRunUrl?: string;
}

export interface TestResultInput {
  title: string;
  file: string;
  status: TestStatus;
  durationMs: number;
  error?: { message: string; stack?: string };
  steps?: TestStep[];
  healing?: Healing;
  logs?: string[];
  /** Base64-encoded JPEG, at most LIMITS.screenshotBytes once decoded. */
  screenshot?: string;
}

export interface RunFinishInput {
  /** Set by the reporter when the run was interrupted or timed out. */
  interrupted?: boolean;
}

export interface RunCounts {
  passed: number;
  failed: number;
  healed: number;
  skipped: number;
}

export interface RunSummary {
  id: string;
  project: string;
  status: RunStatus;
  trigger: RunTrigger;
  targetUrl: string;
  commitSha: string | null;
  commitMessage: string | null;
  ciRunUrl: string | null;
  startedAt: string;
  finishedAt: string | null;
  counts: RunCounts;
}

export interface TestResult {
  id: string;
  title: string;
  file: string;
  status: TestStatus;
  durationMs: number;
  error: { message: string; stack: string | null } | null;
  steps: TestStep[];
  healing: Healing | null;
  logs: string[];
  hasScreenshot: boolean;
}

export interface RunDetail extends RunSummary {
  tests: TestResult[];
}

// ---------- Validation (hand-written to keep the Worker dependency-free) ----------

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function str(o: Obj, key: string, max: number, required: true): string;
function str(o: Obj, key: string, max: number, required?: false): string | undefined;
function str(o: Obj, key: string, max: number, required = false): string | undefined {
  const v = o[key];
  if (v === undefined || v === null) {
    if (required) throw new ValidationError(`${key} is required`);
    return undefined;
  }
  if (typeof v !== "string") throw new ValidationError(`${key} must be a string`);
  if (required && v.trim() === "") throw new ValidationError(`${key} must not be empty`);
  if (v.length > max) throw new ValidationError(`${key} is longer than ${max} characters`);
  return v;
}

function oneOf<T extends string>(o: Obj, key: string, allowed: readonly T[]): T {
  const v = o[key];
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw new ValidationError(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return v as T;
}

function count(o: Obj, key: string): number {
  const v = o[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
    throw new ValidationError(`${key} must be a non-negative number`);
  }
  return Math.round(v);
}

function httpUrl(o: Obj, key: string, required: true): string;
function httpUrl(o: Obj, key: string, required?: false): string | undefined;
function httpUrl(o: Obj, key: string, required = false): string | undefined {
  const v = required ? str(o, key, LIMITS.text, true) : str(o, key, LIMITS.text);
  if (v === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new ValidationError(`${key} must be a URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ValidationError(`${key} must be http(s)`);
  return v;
}

class ValidationError extends Error {}

function guard<T>(body: unknown, parse: (o: Obj) => T): Validated<T> {
  if (!isObj(body)) return { ok: false, error: "body must be a JSON object" };
  try {
    return { ok: true, value: parse(body) };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e.message };
    throw e;
  }
}

export function validateRunStart(body: unknown): Validated<RunStartInput> {
  return guard(body, (o) => ({
    project: str(o, "project", 60, true),
    trigger: oneOf(o, "trigger", TRIGGERS),
    targetUrl: httpUrl(o, "targetUrl", true),
    commitSha: str(o, "commitSha", 64),
    commitMessage: str(o, "commitMessage", LIMITS.text),
    ciRunUrl: httpUrl(o, "ciRunUrl"),
  }));
}

export function validateTestResult(body: unknown): Validated<TestResultInput> {
  return guard(body, (o) => {
    const result: TestResultInput = {
      title: str(o, "title", LIMITS.text, true),
      file: str(o, "file", LIMITS.text, true),
      status: oneOf(o, "status", TEST_STATUSES),
      durationMs: count(o, "durationMs"),
    };

    if (o.error !== undefined && o.error !== null) {
      if (!isObj(o.error)) throw new ValidationError("error must be an object");
      result.error = {
        message: str(o.error, "message", LIMITS.message, true),
        stack: str(o.error, "stack", LIMITS.stack),
      };
    }

    if (o.steps !== undefined) {
      if (!Array.isArray(o.steps) || o.steps.length > LIMITS.steps) {
        throw new ValidationError(`steps must be an array of at most ${LIMITS.steps}`);
      }
      result.steps = o.steps.map((s) => {
        if (!isObj(s)) throw new ValidationError("each step must be an object");
        return {
          title: str(s, "title", LIMITS.text, true),
          durationMs: count(s, "durationMs"),
          failed: s.failed === true,
        };
      });
    }

    if (o.healing !== undefined && o.healing !== null) {
      if (!isObj(o.healing)) throw new ValidationError("healing must be an object");
      result.healing = {
        element: str(o.healing, "element", LIMITS.text, true),
        broken: str(o.healing, "broken", LIMITS.text, true),
        used: str(o.healing, "used", LIMITS.text, true),
        suggestion: str(o.healing, "suggestion", LIMITS.text, true),
      };
    }
    if (result.status === "healed" && !result.healing) throw new ValidationError("healed results need healing details");

    if (o.logs !== undefined) {
      if (!Array.isArray(o.logs) || o.logs.length > LIMITS.logs) {
        throw new ValidationError(`logs must be an array of at most ${LIMITS.logs}`);
      }
      result.logs = o.logs.map((line) => {
        if (typeof line !== "string") throw new ValidationError("each log line must be a string");
        return line.slice(0, LIMITS.logLine);
      });
    }

    const screenshot = str(o, "screenshot", Math.ceil((LIMITS.screenshotBytes * 4) / 3) + 4);
    if (screenshot !== undefined) {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(screenshot)) throw new ValidationError("screenshot must be base64");
      result.screenshot = screenshot;
    }
    return result;
  });
}

export function validateRunFinish(body: unknown): Validated<RunFinishInput> {
  if (body === null || body === undefined) return { ok: true, value: {} };
  return guard(body, (o) => ({ interrupted: o.interrupted === true }));
}
