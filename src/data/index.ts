import { sampleLatestRun } from "./sample";
import type { AiQualityResponse, MetricsResponse, RequirementsResponse, RunDetail, RunSummary, Sourced } from "./types";

export type * from "./types";

const PROJECT = "wealthlite";

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// Falls back to labelled sample data when no real run exists yet or the API is unreachable.
export async function getLatestRun(): Promise<Sourced<RunSummary>> {
  const run = await getJson<RunSummary>(`/api/runs/latest?project=${PROJECT}`);
  return run ? { source: "live", data: run } : { source: "sample", data: sampleLatestRun };
}

export async function getRecentRuns(limit = 10): Promise<RunSummary[]> {
  const body = await getJson<{ runs: RunSummary[] }>(`/api/runs?project=${PROJECT}&limit=${limit}`);
  return body?.runs ?? [];
}

export async function getRun(id: string): Promise<RunDetail | null> {
  return getJson<RunDetail>(`/api/runs/${encodeURIComponent(id)}`);
}

/** Requirements with their linked tests. Null when the API is unreachable. */
export async function getRequirements(): Promise<RequirementsResponse | null> {
  return getJson<RequirementsResponse>("/api/requirements");
}

/** Quality metrics and release readiness. Null when the API is unreachable. */
export async function getMetrics(): Promise<MetricsResponse | null> {
  return getJson<MetricsResponse>("/api/metrics");
}

/** AI eval results: golden-set runs, live draft scores, automation by engine. Null when the API is unreachable. */
export async function getAiQuality(): Promise<AiQualityResponse | null> {
  return getJson<AiQualityResponse>("/api/ai-evals");
}

export const screenshotUrl = (testId: string) => `/api/results/${encodeURIComponent(testId)}/screenshot`;

export const runReportUrl = (runId: string) => `/dashboard/run/?id=${encodeURIComponent(runId)}`;
