-- AI quality: how good the AI-drafted test cases and specs are, with evidence.
--   golden      one row per golden-set eval run in CI (score = average, details = per-story scores)
--   live        one row per real draft scored in n8n before the owner approves it
--   automation  one row per automate-from-jira run in qa-tests (engine claude/local and its outcome)
CREATE TABLE ai_evals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('golden', 'live', 'automation')),
  model TEXT,
  prompt_version TEXT,
  story_key TEXT,
  score REAL,
  summary TEXT,
  details TEXT,
  engine TEXT CHECK (engine IS NULL OR engine IN ('claude', 'local')),
  outcome TEXT,
  run_url TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX ai_evals_kind_created ON ai_evals (kind, created_at DESC);
