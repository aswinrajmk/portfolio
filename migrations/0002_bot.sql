-- Telegram bot state. No secrets are stored here.

-- Telegram may redeliver an update; processing is skipped for ids already seen.
CREATE TABLE bot_updates (
  update_id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL
);

-- Short conversation memory per chat (only final user/assistant text, never tool payloads).
CREATE TABLE bot_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX bot_messages_chat ON bot_messages (chat_id, id DESC);

-- Actions that change something wait here until the owner confirms them.
CREATE TABLE pending_actions (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('code_change', 'merge_pr', 'close_pr', 'start_qa_run')),
  payload TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'cancelled', 'expired', 'failed')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Code change requests sent to a repo's claude-change workflow, updated by its callback.
CREATE TABLE change_requests (
  request_id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  instruction TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'pr_opened', 'no_changes', 'failed', 'merged', 'closed')),
  pr_number INTEGER,
  pr_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Every executed action, for accountability.
CREATE TABLE bot_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_id TEXT,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);
