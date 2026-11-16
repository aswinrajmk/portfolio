import type { Repo } from "./config";

export type ActionKind = "code_change" | "merge_pr" | "close_pr" | "start_qa_run";

export interface PendingAction {
  id: string;
  chat_id: string;
  kind: ActionKind;
  payload: string;
  summary: string;
  status: "pending" | "done" | "cancelled" | "expired" | "failed";
  created_at: string;
  expires_at: string;
}

const CONFIRM_WINDOW_MS = 10 * 60 * 1000;
const MEMORY_MESSAGES = 20;
const now = () => new Date().toISOString();

/** Returns false when the update was already processed (Telegram redelivery). */
export async function claimUpdate(db: D1Database, updateId: number): Promise<boolean> {
  const result = await db
    .prepare("INSERT OR IGNORE INTO bot_updates (update_id, received_at) VALUES (?1, ?2)")
    .bind(updateId, now())
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function history(
  db: D1Database,
  chatId: string,
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { results } = await db
    .prepare("SELECT role, content FROM bot_messages WHERE chat_id = ?1 ORDER BY id DESC LIMIT ?2")
    .bind(chatId, MEMORY_MESSAGES)
    .all<{ role: "user" | "assistant"; content: string }>();
  const ordered = results.reverse();
  // The conversation sent to Claude must start with a user turn.
  while (ordered[0]?.role === "assistant") ordered.shift();
  return ordered;
}

export async function remember(db: D1Database, chatId: string, role: "user" | "assistant", content: string) {
  await db
    .prepare("INSERT INTO bot_messages (chat_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(chatId, role, content.slice(0, 4000), now())
    .run();
}

export async function forget(db: D1Database, chatId: string) {
  await db.prepare("DELETE FROM bot_messages WHERE chat_id = ?1").bind(chatId).run();
}

export async function createPending(
  db: D1Database,
  chatId: string,
  kind: ActionKind,
  payload: object,
  summary: string,
): Promise<PendingAction> {
  // Only one pending confirmation per chat: a new request replaces the old one.
  await db
    .prepare("UPDATE pending_actions SET status = 'cancelled' WHERE chat_id = ?1 AND status = 'pending'")
    .bind(chatId)
    .run();
  const action: PendingAction = {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
    chat_id: chatId,
    kind,
    payload: JSON.stringify(payload),
    summary,
    status: "pending",
    created_at: now(),
    expires_at: new Date(Date.now() + CONFIRM_WINDOW_MS).toISOString(),
  };
  await db
    .prepare(
      `INSERT INTO pending_actions (id, chat_id, kind, payload, summary, status, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(action.id, chatId, kind, action.payload, summary, action.status, action.created_at, action.expires_at)
    .run();
  return action;
}

/** Atomically takes a pending action so a double tap cannot run it twice. Returns null if gone or expired. */
export async function takePending(
  db: D1Database,
  chatId: string,
  id: string | null,
  outcome: "done" | "cancelled",
): Promise<PendingAction | "expired" | null> {
  const row = id
    ? await db
        .prepare("SELECT * FROM pending_actions WHERE id = ?1 AND chat_id = ?2")
        .bind(id, chatId)
        .first<PendingAction>()
    : await db
        .prepare(
          "SELECT * FROM pending_actions WHERE chat_id = ?1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
        )
        .bind(chatId)
        .first<PendingAction>();
  if (!row || row.status !== "pending") return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    await db.prepare("UPDATE pending_actions SET status = 'expired' WHERE id = ?1").bind(row.id).run();
    return "expired";
  }
  const update = await db
    .prepare("UPDATE pending_actions SET status = ?2 WHERE id = ?1 AND status = 'pending'")
    .bind(row.id, outcome)
    .run();
  return (update.meta.changes ?? 0) > 0 ? row : null;
}

export async function listPending(db: D1Database, chatId: string) {
  const { results } = await db
    .prepare(
      "SELECT * FROM pending_actions WHERE chat_id = ?1 AND status = 'pending' AND expires_at > ?2 ORDER BY created_at",
    )
    .bind(chatId, now())
    .all<PendingAction>();
  return results;
}

export async function audit(db: D1Database, actionId: string | null, kind: string, detail: string, outcome: string) {
  await db
    .prepare("INSERT INTO bot_audit (action_id, kind, detail, outcome, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(actionId, kind, detail.slice(0, 2000), outcome, now())
    .run();
}

export async function createChangeRequest(
  db: D1Database,
  requestId: string,
  chatId: string,
  repo: Repo,
  instruction: string,
) {
  await db
    .prepare(
      `INSERT INTO change_requests (request_id, chat_id, repo, instruction, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?5)`,
    )
    .bind(requestId, chatId, repo, instruction, now())
    .run();
}

export async function getChangeRequest(db: D1Database, requestId: string) {
  return db
    .prepare("SELECT * FROM change_requests WHERE request_id = ?1")
    .bind(requestId)
    .first<{ request_id: string; chat_id: string; repo: Repo; instruction: string; status: string }>();
}

export async function updateChangeRequest(
  db: D1Database,
  requestId: string,
  status: string,
  pr?: { number: number; url: string },
) {
  await db
    .prepare(
      "UPDATE change_requests SET status = ?2, pr_number = COALESCE(?3, pr_number), pr_url = COALESCE(?4, pr_url), updated_at = ?5 WHERE request_id = ?1",
    )
    .bind(requestId, status, pr?.number ?? null, pr?.url ?? null, now())
    .run();
}
