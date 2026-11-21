import {
  FULL_SUITE_FILTERS,
  type Coverage,
  type FlakyTest,
  type HealedTest,
  type Healing,
  type MetricsResponse,
  type ReadinessReason,
  type SlowTest,
  type StoredRunStatus,
  type SuiteKind,
  type TestStatus,
  type TrendPoint,
  type Verdict,
} from "../../shared/results";
import { jiraSearch } from "./jira";
import { listRequirements } from "./requirements";

// Quality metrics a QA lead watches, computed from the stored run history (D1) and Jira. Nothing is sampled or
// estimated: every number comes from a stored result, so the dashboard never shows a metric it cannot back up.

const WINDOW_RUNS = 30;
const WINDOW_DAYS = 30;
const STALE_REGRESSION_MS = 36 * 60 * 60 * 1000;
const MIN_COVERAGE = 0.5;
const DASHBOARD = "/dashboard/";

interface RunRow {
  id: string;
  status: StoredRunStatus;
  filter: string | null;
  commit_sha: string | null;
  started_at: string;
  finished_at: string | null;
}

interface ResultRow {
  run_id: string;
  title: string;
  file: string;
  status: TestStatus;
  duration_ms: number;
  healing: string | null;
}

export function suiteOf(filter: string | null): SuiteKind {
  if (filter === null || (FULL_SUITE_FILTERS as readonly string[]).includes(filter)) return "regression";
  if (filter === "@smoke") return "smoke";
  return "partial";
}

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? null) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

const ms = (from: string, to: string | null) => (to ? Date.parse(to) - Date.parse(from) : NaN);
const testId = (r: { file: string; title: string }) => `${r.file}::${r.title}`;
const passed = (s: TestStatus) => s === "passed" || s === "healed";

/** Pure: everything except Jira and requirements, so it can be reasoned about from rows alone. */
export function computeRunMetrics(runs: RunRow[], results: ResultRow[]) {
  const byRun = new Map<string, ResultRow[]>();
  for (const r of results) byRun.set(r.run_id, [...(byRun.get(r.run_id) ?? []), r]);
  const oldestFirst = [...runs].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const suiteRuns = oldestFirst.filter((r) => suiteOf(r.filter) !== "partial");

  const trend: TrendPoint[] = [];
  let ok = 0;
  let ran = 0;
  for (const run of oldestFirst) {
    const rows = (byRun.get(run.id) ?? []).filter((r) => r.status !== "skipped");
    if (!rows.length) continue;
    const good = rows.filter((r) => passed(r.status)).length;
    const suite = suiteOf(run.filter);
    trend.push({ runId: run.id, suite, startedAt: run.started_at, passRate: good / rows.length, status: run.status });
    if (suite !== "partial") {
      ok += good;
      ran += rows.length;
    }
  }

  // Flaky: the same test both passed and failed on the same app commit. A code change cannot explain that.
  const perCommit = new Map<string, { row: ResultRow; commit: string; failures: number; passes: number }>();
  const commitOf = new Map(runs.map((r) => [r.id, r.commit_sha]));
  for (const r of results) {
    const commit = commitOf.get(r.run_id);
    if (!commit || r.status === "skipped") continue;
    const key = `${commit}::${testId(r)}`;
    const entry = perCommit.get(key) ?? { row: r, commit, failures: 0, passes: 0 };
    if (passed(r.status)) entry.passes++;
    else entry.failures++;
    perCommit.set(key, entry);
  }
  const flaky: FlakyTest[] = [...perCommit.values()]
    .filter((e) => e.failures > 0 && e.passes > 0)
    .map((e) => ({ title: e.row.title, file: e.row.file, commit: e.commit, failures: e.failures, passes: e.passes }))
    .sort((a, b) => b.failures - a.failures);

  // Healed locators still to fix: tests whose latest result was healed.
  const latest = new Map<string, ResultRow>();
  for (const run of [...oldestFirst].reverse()) {
    for (const r of byRun.get(run.id) ?? []) if (!latest.has(testId(r))) latest.set(testId(r), r);
  }
  const healed: HealedTest[] = [...latest.values()]
    .filter((r) => r.status === "healed")
    .map((r) => {
      let h: Partial<Healing> = {};
      try {
        h = JSON.parse(r.healing ?? "{}") as Healing;
      } catch {
        /* keep defaults */
      }
      return {
        title: r.title,
        file: r.file,
        element: h.element ?? "",
        suggestion: h.suggestion ?? "",
        runId: r.run_id,
      };
    });

  const durations = new Map<string, number[]>();
  for (const r of results) durations.set(testId(r), [...(durations.get(testId(r)) ?? []), r.duration_ms]);
  const slowest: SlowTest[] = [...durations.entries()]
    .map(([id, list]) => {
      const [file = "", title = ""] = id.split("::");
      return { title, file, avgMs: Math.round(list.reduce((a, b) => a + b, 0) / list.length), runs: list.length };
    })
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 5);

  const runDurations = (suite: SuiteKind) =>
    median(
      suiteRuns
        .filter((r) => suiteOf(r.filter) === suite)
        .map((r) => ms(r.started_at, r.finished_at))
        .filter((n) => n >= 0),
    );

  // Time to green: from the first failed run of a red streak to the next passed run of the same suite.
  const recoveries: number[] = [];
  for (const suite of ["smoke", "regression"] as const) {
    const list = suiteRuns.filter((r) => suiteOf(r.filter) === suite);
    let redSince: string | null = null;
    for (const run of list) {
      if (run.status === "failed" && !redSince) redSince = run.started_at;
      if (run.status === "passed" && redSince) {
        recoveries.push(ms(redSince, run.finished_at ?? run.started_at));
        redSince = null;
      }
    }
  }

  return {
    passRate: ran ? ok / ran : null,
    trend,
    flaky,
    healed,
    slowest,
    medianDurationMs: { smoke: runDurations("smoke"), regression: runDurations("regression") },
    timeToGreenMs: median(recoveries),
    latestSuiteRun: [...suiteRuns].reverse()[0] ?? null,
    latestRegression: [...suiteRuns].reverse().find((r) => suiteOf(r.filter) === "regression") ?? null,
  };
}

interface ReadinessInput {
  latestSuiteRun: RunRow | null;
  latestRegression: RunRow | null;
  failingStories: string[];
  flaky: number;
  healed: number;
  coverage: Coverage | null;
  now: number;
}

/** Pure release rules. Each reason names its evidence, so the verdict can be checked, not just trusted. */
export function readiness(i: ReadinessInput): { verdict: Verdict; reasons: ReadinessReason[] } {
  const reasons: ReadinessReason[] = [];
  const report = (run: RunRow) => `${DASHBOARD}run/?id=${encodeURIComponent(run.id)}`;
  if (!i.latestSuiteRun) reasons.push({ level: "no-go", text: "No smoke or regression run is recorded yet." });
  else if (i.latestSuiteRun.status === "failed")
    reasons.push({ level: "no-go", text: "The latest suite run failed.", href: report(i.latestSuiteRun) });
  for (const story of i.failingStories)
    reasons.push({ level: "no-go", text: `Story ${story} has a failing test.`, href: `${DASHBOARD}#requirements` });
  if (!i.latestRegression || i.now - Date.parse(i.latestRegression.started_at) > STALE_REGRESSION_MS)
    reasons.push({ level: "caution", text: "No regression run in the last 36 hours." });
  if (i.flaky)
    reasons.push({
      level: "caution",
      text: `${i.flaky} flaky test(s): fix or quarantine with an owner.`,
      href: `${DASHBOARD}#metrics`,
    });
  if (i.healed)
    reasons.push({
      level: "caution",
      text: `${i.healed} healed locator(s) still to fix.`,
      href: `${DASHBOARD}#metrics`,
    });
  if (i.coverage && i.coverage.total && i.coverage.automated / i.coverage.total < MIN_COVERAGE)
    reasons.push({
      level: "caution",
      text: `Only ${i.coverage.automated} of ${i.coverage.total} approved Jira test cases are automated.`,
    });
  if (!i.coverage)
    reasons.push({ level: "caution", text: "Jira could not be reached, so automation coverage is unknown." });
  const verdict: Verdict = reasons.some((r) => r.level === "no-go")
    ? "no-go"
    : reasons.some((r) => r.level === "caution")
      ? "caution"
      : "go";
  if (verdict === "go")
    reasons.push({ level: "go", text: "Latest runs passed, nothing flaky or healed, coverage on target." });
  return { verdict, reasons };
}

const COVERAGE_CACHE_MS = 5 * 60 * 1000;
let coverageCache: { at: number; value: Coverage } | null = null;

async function coverage(env: Env): Promise<Coverage | null> {
  if (coverageCache && Date.now() - coverageCache.at < COVERAGE_CACHE_MS) return coverageCache.value;
  try {
    const tests = await jiraSearch(env, "project = KAN AND issuetype = Test", ["labels"]);
    const has = (labels: string[] | undefined, l: string) => (labels ?? []).includes(l);
    const value: Coverage = {
      total: tests.length,
      automated: tests.filter((t) => has(t.fields.labels, "automated")).length,
      smoke: tests.filter((t) => has(t.fields.labels, "smoke")).length,
      regression: tests.filter((t) => has(t.fields.labels, "regression")).length,
      pending: tests.filter((t) =>
        ["auto-pending", "auto-queued", "auto-pr-open", "auto-failed"].some((l) => has(t.fields.labels, l)),
      ).length,
    };
    coverageCache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.warn(`[metrics] could not read Jira tests: ${String(err)}`);
    return coverageCache?.value ?? null;
  }
}

export async function getMetrics(env: Env, project: string): Promise<MetricsResponse> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recent = `SELECT id FROM runs WHERE project = ?1 AND status != 'running' AND started_at >= ?2
                  ORDER BY started_at DESC LIMIT ${WINDOW_RUNS}`;
  const [runs, results, cov, reqs] = await Promise.all([
    env.DB.prepare(`SELECT id, status, filter, commit_sha, started_at, finished_at FROM runs WHERE id IN (${recent})`)
      .bind(project, since)
      .all<RunRow>(),
    env.DB.prepare(
      `SELECT run_id, title, file, status, duration_ms, healing FROM test_results WHERE run_id IN (${recent}) LIMIT 5000`,
    )
      .bind(project, since)
      .all<ResultRow>(),
    coverage(env),
    listRequirements(env, project),
  ]);
  const m = computeRunMetrics(runs.results, results.results);
  return {
    window: { runs: runs.results.length, days: WINDOW_DAYS },
    passRate: m.passRate,
    trend: m.trend,
    flaky: m.flaky,
    healed: m.healed,
    slowest: m.slowest,
    medianDurationMs: m.medianDurationMs,
    timeToGreenMs: m.timeToGreenMs,
    coverage: cov,
    readiness: readiness({
      latestSuiteRun: m.latestSuiteRun,
      latestRegression: m.latestRegression,
      failingStories: reqs.requirements.filter((r) => r.state === "failing").map((r) => r.key),
      flaky: m.flaky.length,
      healed: m.healed.length,
      coverage: cov,
      now: Date.now(),
    }),
  };
}
