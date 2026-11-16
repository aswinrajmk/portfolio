-- Results store for test runs. Counts are derived from test_results on read, so they never drift.
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed')),
  trigger TEXT NOT NULL CHECK (trigger IN ('deploy', 'manual')),
  target_url TEXT NOT NULL,
  commit_sha TEXT,
  commit_message TEXT,
  ci_run_url TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX runs_project_started ON runs (project, started_at DESC);

CREATE TABLE test_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  file TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'healed', 'skipped')),
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  steps TEXT,
  healing TEXT,
  logs TEXT,
  screenshot BLOB,
  created_at TEXT NOT NULL
);

CREATE INDEX test_results_run ON test_results (run_id, seq);
