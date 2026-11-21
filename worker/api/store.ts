import {
  LIMITS,
  FULL_SUITE_FILTERS,
  JIRA_TAG,
  type RequirementTest,
  type RunCounts,
  type RunDetail,
  type RunStartInput,
  type RunSummary,
  type StoredRunStatus,
  type TestResult,
  type TestResultInput,
} from "../../shared/results";

interface RunRow {
  id: string;
  project: string;
  status: StoredRunStatus;
  trigger: RunSummary["trigger"];
  target_url: string;
  commit_sha: string | null;
  commit_message: string | null;
  ci_run_url: string | null;
  filter: string | null;
  started_at: string;
  finished_at: string | null;
  passed: number | null;
  failed: number | null;
  healed: number | null;
  skipped: number | null;
}

interface TestRow {
  id: string;
  title: string;
  file: string;
  status: TestResult["status"];
  duration_ms: number;
  error_message: string | null;
  error_stack: string | null;
  steps: string | null;
  healing: string | null;
  logs: string | null;
  tags: string | null;
  has_screenshot: number;
}

const RUN_COLUMNS = `
  r.id, r.project, r.status, r.trigger, r.target_url, r.commit_sha, r.commit_message, r.ci_run_url,
  r.filter, r.started_at, r.finished_at,
  SUM(t.status = 'passed') AS passed, SUM(t.status = 'failed') AS failed,
  SUM(t.status = 'healed') AS healed, SUM(t.status = 'skipped') AS skipped`;

function toSummary(row: RunRow, now = Date.now()): RunSummary {
  const abandoned = row.status === "running" && now - Date.parse(row.started_at) > LIMITS.abandonAfterMs;
  const counts: RunCounts = {
    passed: row.passed ?? 0,
    failed: row.failed ?? 0,
    healed: row.healed ?? 0,
    skipped: row.skipped ?? 0,
  };
  return {
    id: row.id,
    project: row.project,
    status: abandoned ? "incomplete" : row.status,
    trigger: row.trigger,
    targetUrl: row.target_url,
    commitSha: row.commit_sha,
    commitMessage: row.commit_message,
    ciRunUrl: row.ci_run_url,
    filter: row.filter,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    counts,
  };
}

function parseJson<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function toTest(row: TestRow): TestResult {
  return {
    id: row.id,
    title: row.title,
    file: row.file,
    status: row.status,
    durationMs: row.duration_ms,
    error: row.error_message ? { message: row.error_message, stack: row.error_stack } : null,
    steps: parseJson(row.steps, []),
    healing: parseJson(row.healing, null),
    logs: parseJson(row.logs, []),
    tags: parseJson(row.tags, []),
    hasScreenshot: row.has_screenshot === 1,
  };
}

export async function listRuns(db: D1Database, project: string, limit: number): Promise<RunSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT ${RUN_COLUMNS} FROM runs r LEFT JOIN test_results t ON t.run_id = r.id
       WHERE r.project = ?1 GROUP BY r.id ORDER BY r.started_at DESC LIMIT ?2`,
    )
    .bind(project, limit)
    .all<RunRow>();
  return results.map((row) => toSummary(row));
}

export async function getRun(db: D1Database, id: string): Promise<RunDetail | null> {
  const [run, tests] = await db.batch([
    db
      .prepare(
        `SELECT ${RUN_COLUMNS} FROM runs r LEFT JOIN test_results t ON t.run_id = r.id WHERE r.id = ?1 GROUP BY r.id`,
      )
      .bind(id),
    db
      .prepare(
        `SELECT id, title, file, status, duration_ms, error_message, error_stack, steps, healing, logs, tags,
              screenshot IS NOT NULL AS has_screenshot
       FROM test_results WHERE run_id = ?1 ORDER BY seq`,
      )
      .bind(id),
  ]);
  const row = (run?.results as RunRow[] | undefined)?.[0];
  if (!row) return null;
  return { ...toSummary(row), tests: ((tests?.results ?? []) as TestRow[]).map(toTest) };
}

export async function createRun(db: D1Database, input: RunStartInput): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO runs (id, project, status, trigger, target_url, commit_sha, commit_message, ci_run_url, filter, started_at)
       VALUES (?1, ?2, 'running', ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      id,
      input.project,
      input.trigger,
      input.targetUrl,
      input.commitSha ?? null,
      input.commitMessage ?? null,
      input.ciRunUrl ?? null,
      input.filter ?? null,
      new Date().toISOString(),
    )
    .run();
  return id;
}

export async function runState(db: D1Database, id: string): Promise<StoredRunStatus | null> {
  const row = await db.prepare("SELECT status FROM runs WHERE id = ?1").bind(id).first<{ status: StoredRunStatus }>();
  return row?.status ?? null;
}

export async function addResult(
  db: D1Database,
  runId: string,
  input: TestResultInput,
  screenshot: Uint8Array | null,
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO test_results
         (id, run_id, seq, title, file, status, duration_ms, error_message, error_stack, steps, healing, logs, tags, screenshot, created_at)
       VALUES (?1, ?2, (SELECT COUNT(*) FROM test_results WHERE run_id = ?2), ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
    )
    .bind(
      id,
      runId,
      input.title,
      input.file,
      input.status,
      input.durationMs,
      input.error?.message ?? null,
      input.error?.stack ?? null,
      input.steps ? JSON.stringify(input.steps) : null,
      input.healing ? JSON.stringify(input.healing) : null,
      input.logs ? JSON.stringify(input.logs) : null,
      input.tags?.length ? JSON.stringify(input.tags) : null,
      screenshot,
      new Date().toISOString(),
    )
    .run();
  return id;
}

// The final status comes from the stored results, so a reporter cannot mark a run with failures as passed.
export async function finishRun(db: D1Database, id: string, interrupted: boolean): Promise<StoredRunStatus> {
  const row = await db
    .prepare("SELECT COUNT(*) AS failures FROM test_results WHERE run_id = ?1 AND status = 'failed'")
    .bind(id)
    .first<{ failures: number }>();
  const status: StoredRunStatus = interrupted || (row?.failures ?? 0) > 0 ? "failed" : "passed";
  await db
    .prepare("UPDATE runs SET status = ?2, finished_at = ?3 WHERE id = ?1")
    .bind(id, status, new Date().toISOString())
    .run();
  return status;
}

export async function getScreenshot(db: D1Database, testId: string): Promise<ArrayBuffer | null> {
  const row = await db
    .prepare("SELECT screenshot FROM test_results WHERE id = ?1")
    .bind(testId)
    .first<{ screenshot: ArrayBuffer | number[] | null }>();
  if (!row?.screenshot) return null;
  return row.screenshot instanceof ArrayBuffer ? row.screenshot : new Uint8Array(row.screenshot).buffer;
}

/**
 * The latest result of every test tagged with a Jira story (@KAN-n), grouped by story key.
 * Only finished runs count, so a run in progress never flips a story's state halfway. Results older than the
 * latest full-suite run with tagged tests are ignored, so renamed or deleted tests drop out.
 */
export async function requirementResults(db: D1Database, project: string): Promise<Map<string, RequirementTest[]>> {
  const fullFilters = FULL_SUITE_FILTERS.map((_, i) => `?${i + 2}`).join(", ");
  const { results } = await db
    .prepare(
      `SELECT t.title, t.file, t.status, t.tags, t.run_id, r.started_at
       FROM test_results t JOIN runs r ON r.id = t.run_id
       WHERE r.project = ?1 AND r.status != 'running' AND t.tags LIKE '%"@KAN-%'
         AND r.started_at >= COALESCE(
           (SELECT MAX(r2.started_at) FROM runs r2
            WHERE r2.project = ?1 AND r2.status != 'running' AND (r2.filter IS NULL OR r2.filter IN (${fullFilters}))
              AND EXISTS (SELECT 1 FROM test_results t2 WHERE t2.run_id = r2.id AND t2.tags LIKE '%"@KAN-%')), '')
       ORDER BY r.started_at DESC, t.seq
       LIMIT 2000`,
    )
    .bind(project, ...FULL_SUITE_FILTERS)
    .all<{
      title: string;
      file: string;
      status: RequirementTest["status"];
      tags: string;
      run_id: string;
      started_at: string;
    }>();

  const byStory = new Map<string, RequirementTest[]>();
  const seen = new Set<string>();
  for (const row of results) {
    // Rows are newest first, so the first time a test appears is its latest result.
    const id = `${row.file}::${row.title}`;
    if (seen.has(id)) continue;
    seen.add(id);
    // The first Jira tag is the story (describe tags come first); later ones are Test issues.
    const story = parseJson<string[]>(row.tags, [])
      .map((tag) => JIRA_TAG.exec(tag)?.[1])
      .find(Boolean);
    if (!story) continue;
    const list = byStory.get(story) ?? [];
    list.push({ title: row.title, file: row.file, status: row.status, runId: row.run_id, ranAt: row.started_at });
    byStory.set(story, list);
  }
  return byStory;
}
