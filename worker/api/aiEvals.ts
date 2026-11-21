import type { AiEngine, AiEvalInput, AiQualityResponse, EngineStats, GoldenRun, LiveDraft } from "../../shared/results";

// Stores and summarises evals of the AI that drafts tests: golden-set runs (CI), live draft scores (n8n), and
// automation outcomes per engine (qa-tests). Writes need AI_EVALS_TOKEN, a token that can do nothing else.

const WINDOW_DAYS = 90;

export async function addAiEval(db: D1Database, input: AiEvalInput): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ai_evals (id, kind, model, prompt_version, story_key, score, summary, details, engine, outcome, run_url, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
    .bind(
      id,
      input.kind,
      input.model ?? null,
      input.promptVersion ?? null,
      input.storyKey ?? null,
      input.score ?? null,
      input.summary ?? null,
      input.details ? JSON.stringify(input.details) : null,
      input.engine ?? null,
      input.outcome ?? null,
      input.runUrl ?? null,
      new Date().toISOString(),
    )
    .run();
  return id;
}

interface Row {
  kind: string;
  model: string | null;
  prompt_version: string | null;
  story_key: string | null;
  score: number | null;
  summary: string | null;
  details: string | null;
  engine: AiEngine | null;
  outcome: string | null;
  run_url: string | null;
  created_at: string;
}

export async function aiQuality(db: D1Database): Promise<AiQualityResponse> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT kind, model, prompt_version, story_key, score, summary, details, engine, outcome, run_url, created_at
       FROM ai_evals WHERE created_at >= ?1 ORDER BY created_at DESC LIMIT 1000`,
    )
    .bind(since)
    .all<Row>();

  const golden = results.filter((r) => r.kind === "golden" && r.score !== null);
  const toGolden = (r: Row): GoldenRun => {
    let perStory: Record<string, number> = {};
    try {
      perStory = (JSON.parse(r.details ?? "{}") as { perStory?: Record<string, number> }).perStory ?? {};
    } catch {
      perStory = {};
    }
    return {
      model: r.model ?? "",
      promptVersion: r.prompt_version ?? "",
      mean: r.score ?? 0,
      perStory,
      at: r.created_at,
      runUrl: r.run_url,
    };
  };

  const storyIssueOf = (r: Row): string | null => {
    try {
      return (JSON.parse(r.details ?? "{}") as { storyIssue?: string }).storyIssue ?? null;
    } catch {
      return null;
    }
  };
  const allLive = results.filter((r) => r.kind === "live" && r.score !== null);
  // A draft for a story without acceptance criteria says something about the story, not the model.
  const live = allLive.filter((r) => !storyIssueOf(r));
  const recent: LiveDraft[] = allLive.slice(0, 10).map((r) => ({
    storyKey: r.story_key ?? "",
    score: r.score ?? 0,
    summary: r.summary ?? "",
    storyIssue: storyIssueOf(r),
    promptVersion: r.prompt_version,
    at: r.created_at,
  }));

  const byEngine = new Map<AiEngine, EngineStats>();
  for (const r of results.filter((x) => x.kind === "automation" && x.engine)) {
    const engine = r.engine as AiEngine;
    const s = byEngine.get(engine) ?? { engine, runs: 0, prOpened: 0, draft: 0, failed: 0, noChanges: 0 };
    s.runs++;
    if (r.outcome === "pr_opened" || r.outcome === "pr_updated") s.prOpened++;
    else if (r.outcome === "draft") s.draft++;
    else if (r.outcome === "no_changes") s.noChanges++;
    else s.failed++;
    byEngine.set(engine, s);
  }

  return {
    golden: {
      latest: golden[0] ? toGolden(golden[0]) : null,
      trend: golden
        .slice(0, 10)
        .reverse()
        .map((r) => ({
          at: r.created_at,
          mean: r.score ?? 0,
          model: r.model ?? "",
          promptVersion: r.prompt_version ?? "",
        })),
    },
    live: {
      count: live.length,
      average: live.length ? Math.round((live.reduce((a, r) => a + (r.score ?? 0), 0) / live.length) * 10) / 10 : null,
      storyIssues: allLive.length - live.length,
      recent,
    },
    automation: (["claude", "local"] as const).map(
      (engine) => byEngine.get(engine) ?? { engine, runs: 0, prOpened: 0, draft: 0, failed: 0, noChanges: 0 },
    ),
  };
}
