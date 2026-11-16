import type { RunSummary } from "./types";

// Mock data for Phase 1. Shown with a "Sample data" badge; never presented as a real run.
export const sampleLatestRun: RunSummary = {
  source: "sample",
  id: "sample-run",
  outcome: "passed",
  branch: "main",
  commit: "a1b2c3d",
  environment: "preview",
  startedAt: "2026-11-16T09:30:00Z",
  durationSeconds: 94,
  suites: [
    { name: "Smoke", passed: 12, failed: 0, skipped: 0 },
    { name: "Regression", passed: 48, failed: 0, skipped: 2 },
    { name: "API", passed: 31, failed: 0, skipped: 0 },
  ],
};
