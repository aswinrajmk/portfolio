// "sample" data is mock data shown with a visible label. "live" comes from the Results API (Phase 2).
export type DataSource = "sample" | "live";

export type RunOutcome = "passed" | "failed" | "running";

export interface SuiteResult {
  name: string;
  passed: number;
  failed: number;
  skipped: number;
}

export interface RunSummary {
  source: DataSource;
  id: string;
  outcome: RunOutcome;
  branch: string;
  commit: string;
  environment: string;
  startedAt: string;
  durationSeconds: number;
  suites: SuiteResult[];
}
