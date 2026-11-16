import type { RunSummary } from "./types";

// Shown only while the Results API has no runs. Always rendered with a "Sample data" badge.
export const sampleLatestRun: RunSummary = {
  id: "sample-run",
  project: "wealthlite",
  status: "passed",
  trigger: "deploy",
  targetUrl: "https://wealthlite.aswin-qa.workers.dev",
  commitSha: "a1b2c3d",
  commitMessage: "Sample commit",
  ciRunUrl: null,
  filter: null,
  startedAt: "2026-11-16T09:30:00Z",
  finishedAt: "2026-11-16T09:31:34Z",
  counts: { passed: 9, failed: 0, healed: 1, skipped: 0 },
};
