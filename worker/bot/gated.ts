import type { BotConfig, Repo } from "./config";
import { GitHub, sensitiveFiles } from "./github";
import { createPending, type PendingAction } from "./store";

// Checks shared by the AI tools and the shortcut commands. Each one either refuses with a reason or creates
// a pending action that waits for the owner's YES. Nothing here changes anything outside the bot's own tables.

export interface Prepared {
  pending: PendingAction | null;
  message: string;
}

/** A Playwright --grep pattern: tags, words and simple alternation only. Empty means the whole suite. */
export function cleanFilter(value: unknown): string | null {
  const filter = String(value ?? "").trim();
  if (filter === "") return "";
  return /^[\w@ .|()-]{1,80}$/.test(filter) ? filter : null;
}

export async function prepareMerge(
  env: Env,
  cfg: BotConfig,
  chatId: string,
  repo: Repo,
  number: number,
): Promise<Prepared> {
  if (!cfg.githubToken) return { pending: null, message: "GitHub access is not configured for the bot yet." };
  const pr = await new GitHub(cfg.githubToken, cfg.githubOwner, cfg.githubApi).pr(repo, number);
  const refuse = (message: string): Prepared => ({ pending: null, message });
  if (pr.state !== "open") return refuse(`PR #${pr.number} is not open (merged: ${pr.merged}).`);
  if (pr.checks.total === 0) return refuse(`PR #${pr.number} has no checks yet. Wait for CI to start, then ask again.`);
  if (pr.checks.pending.length)
    return refuse(`Checks still running on PR #${pr.number}: ${pr.checks.pending.join(", ")}.`);
  if (pr.checks.failed.length)
    return refuse(`Cannot merge PR #${pr.number}: failing checks ${pr.checks.failed.join(", ")}.`);
  const sensitive = sensitiveFiles(pr.files);
  const pending = await createPending(
    env.DB,
    chatId,
    "merge_pr",
    { repo, number: pr.number, sha: pr.headSha, sensitive },
    `Merge ${repo} PR #${pr.number}: ${pr.title}`,
  );
  return {
    pending,
    message: sensitive.length
      ? `Confirmation sent. This PR changes sensitive files (${sensitive.join(", ")}), so Aswin must reply MERGE ANYWAY.`
      : "Confirmation sent to Aswin with YES/Cancel buttons. All checks passed.",
  };
}

export async function prepareRun(env: Env, chatId: string, rawFilter: unknown): Promise<Prepared> {
  const filter = cleanFilter(rawFilter);
  if (filter === null)
    return {
      pending: null,
      message: "That filter is not allowed. Use tags or words, for example @REQ-3 or login.",
    };
  const pending = await createPending(
    env.DB,
    chatId,
    "start_qa_run",
    { filter },
    filter
      ? `Start the QA suite (tests matching ${filter}) against live wealthlite`
      : "Start the QA suite against live wealthlite",
  );
  return { pending, message: "Confirmation sent to Aswin with YES/Cancel buttons." };
}
