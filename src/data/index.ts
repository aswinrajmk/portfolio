import { sampleLatestRun } from "./sample";
import type { RunSummary } from "./types";

export type { DataSource, RunOutcome, RunSummary, SuiteResult } from "./types";

// Phase 2 replaces the body with a call to the Results API. Callers must not change.
export async function getLatestRun(): Promise<RunSummary> {
  return sampleLatestRun;
}

export function totals(run: RunSummary) {
  return run.suites.reduce(
    (sum, suite) => ({
      passed: sum.passed + suite.passed,
      failed: sum.failed + suite.failed,
      skipped: sum.skipped + suite.skipped,
    }),
    { passed: 0, failed: 0, skipped: 0 },
  );
}
