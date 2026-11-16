import type { RequirementState, RunStatus, RunSummary, TestStatus } from "../data";

// Run and test status are carried by text and an icon, never colour alone.
const RUN_LABEL: Record<RunStatus, string> = {
  running: "Running",
  passed: "Passed",
  failed: "Failed",
  incomplete: "Incomplete",
};

const TEST_LABEL: Record<TestStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  healed: "Healed",
  skipped: "Skipped",
};

type Kind = RunStatus | TestStatus;

function Icon({ kind }: { kind: Kind }) {
  return (
    <svg className="outcome__icon" viewBox="0 0 12 12" aria-hidden="true">
      {kind === "passed" && <path d="M2.5 6.5l2.3 2.3L9.5 3.8" />}
      {kind === "failed" && <path d="M3 3l6 6M9 3l-6 6" />}
      {kind === "healed" && <path d="M6 2v8M2 6h8" />}
      {kind === "skipped" && <path d="M3 6h6" />}
      {kind === "running" && <circle cx="6" cy="6" r="3" className="outcome__pulse" />}
      {kind === "incomplete" && <path d="M6 3v3.5M6 8.6v.1" />}
    </svg>
  );
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`outcome outcome--${status}`} data-run-status={status}>
      <Icon kind={status} />
      {RUN_LABEL[status]}
    </span>
  );
}

export function TestStatusBadge({ status }: { status: TestStatus }) {
  return (
    <span className={`outcome outcome--${status}`} data-test-status={status}>
      <Icon kind={status} />
      {TEST_LABEL[status]}
    </span>
  );
}

// Requirement states reuse the outcome styles: passing looks like passed, failing like failed.
const REQUIREMENT: Record<RequirementState, { kind: Kind; label: string }> = {
  passing: { kind: "passed", label: "Passing" },
  failing: { kind: "failed", label: "Failing" },
  untested: { kind: "skipped", label: "No tests yet" },
};

export function RequirementStateBadge({ state }: { state: RequirementState }) {
  const { kind, label } = REQUIREMENT[state];
  return (
    <span className={`outcome outcome--${kind}`} data-requirement-state={state}>
      <Icon kind={kind} />
      {label}
    </span>
  );
}

export function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 1) return `${ms} ms`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function runDuration(run: RunSummary) {
  if (!run.finishedAt) return null;
  return formatDuration(Date.parse(run.finishedAt) - Date.parse(run.startedAt));
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export const formatDate = (iso: string) => DATE_FORMAT.format(new Date(iso));

export const shortSha = (sha: string | null) => (sha ? sha.slice(0, 7) : "—");

export function Counts({ run }: { run: RunSummary }) {
  const { passed, failed, healed, skipped } = run.counts;
  return (
    <span className="counts">
      <span className="num">{passed}</span> passed · <span className="num">{failed}</span> failed ·{" "}
      <span className="num">{healed}</span> healed · <span className="num">{skipped}</span> skipped
    </span>
  );
}
