import type { BotConfig, Repo } from "./config";
import { GitHub } from "./github";
import { audit, createChangeRequest, updateChangeRequest, type PendingAction } from "./store";
import { esc } from "./telegram";

// Executes an action the owner confirmed. Runs in Worker code; the model is not involved here.
export async function execute(env: Env, cfg: BotConfig, action: PendingAction): Promise<string> {
  if (!cfg.githubToken) return "GitHub access is not configured for the bot yet, so nothing was done.";
  const gh = new GitHub(cfg.githubToken, cfg.githubOwner, cfg.githubApi);
  const payload = JSON.parse(action.payload) as Record<string, unknown>;
  const repo = payload.repo as Repo;

  try {
    switch (action.kind) {
      case "code_change": {
        const instruction = String(payload.instruction);
        await createChangeRequest(env.DB, action.id, action.chat_id, repo, instruction);
        await gh.dispatch(repo, "claude-change.yml", { instruction, request_id: action.id });
        await audit(env.DB, action.id, action.kind, `${repo}: ${instruction}`, "dispatched");
        return `🛠 Working on it in <b>${esc(repo)}</b>. I'll send the pull request here when it's ready (usually 2–5 minutes).`;
      }
      case "merge_pr": {
        const number = Number(payload.number);
        await gh.merge(repo, number, String(payload.sha));
        await audit(env.DB, action.id, action.kind, `${repo}#${number}`, "merged");
        const next =
          repo === "wealthlite"
            ? "WealthLite is deploying; the QA run report will arrive in the channel."
            : repo === "portfolio"
              ? "The portfolio site is deploying."
              : "The change is on main and is used by the next QA run.";
        return `✅ Merged ${esc(repo)} PR #${number}. ${next}`;
      }
      case "close_pr": {
        const number = Number(payload.number);
        await gh.close(repo, number);
        await audit(env.DB, action.id, action.kind, `${repo}#${number}`, "closed");
        await env.DB.prepare("UPDATE change_requests SET status = 'closed' WHERE repo = ?1 AND pr_number = ?2")
          .bind(repo, number)
          .run();
        return `Closed ${esc(repo)} PR #${number} without merging.`;
      }
      case "start_qa_run": {
        await gh.dispatch("qa-tests", "qa.yml", {});
        await audit(env.DB, action.id, action.kind, "qa-tests", "dispatched");
        return "▶️ QA run started. The report will arrive in the channel when it finishes.";
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await audit(env.DB, action.id, action.kind, message, "failed");
    if (action.kind === "code_change") await updateChangeRequest(env.DB, action.id, "failed");
    return `⚠️ That failed: ${esc(message.slice(0, 300))}`;
  }
  return "Nothing to do.";
}
