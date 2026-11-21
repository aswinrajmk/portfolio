import Anthropic from "@anthropic-ai/sdk";
import { isAuthorized, json, readJson } from "../api/http";
import { listRequirements } from "../api/requirements";
import { listRuns } from "../api/store";
import { execute } from "./actions";
import { respond } from "./agent";
import { botConfig, REPOS, type BotConfig, type Repo } from "./config";
import { prepareMerge, prepareRun, type Prepared } from "./gated";
import { GitHub, sensitiveFiles } from "./github";
import {
  claimUpdate,
  forget,
  getChangeRequest,
  history,
  listPending,
  remember,
  takePending,
  updateChangeRequest,
  type PendingAction,
} from "./store";
import { esc, Telegram, type InlineButton } from "./telegram";

interface TelegramUpdate {
  update_id: number;
  message?: { message_id: number; chat: { id: number; type: string }; from?: { id: number }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
}

const HELP = [
  "<b>Ask me anything about the QA runs</b>, for example:",
  "• How did the last run go?",
  "• Why did the copy test fail?",
  "• Rename the sign-in button to Log in (wealthlite)",
  "• Update the copy test to expect Log in (qa-tests)",
  "• Which requirements are failing?",
  "• Run the tests for story KAN-10",
  "• Merge wealthlite PR 12",
  "",
  "<b>Shortcuts</b> (work without AI credit):",
  "/latest · /runs · /reqs (requirement coverage)",
  "/run [filter], e.g. /run @KAN-10, /run @smoke or /run login",
  "/merge &lt;repo&gt; &lt;number&gt;, e.g. /merge qa-tests 12",
  "/pending · /reset · /help",
  "",
  "Anything that changes code or starts a run asks for YES first.",
].join("\n");

const confirmButtons = (id: string, sensitive: boolean): InlineButton[][] =>
  sensitive
    ? [[{ text: "Cancel", callback_data: `no:${id}` }]]
    : [
        [
          { text: "✅ YES", callback_data: `yes:${id}` },
          { text: "Cancel", callback_data: `no:${id}` },
        ],
      ];

/** POST /telegram/webhook */
export async function handleTelegram(request: Request, env: Env): Promise<Response> {
  const cfg = botConfig(env);
  if (!cfg) return json({ error: "not_configured" }, 503);
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== cfg.webhookSecret) {
    return json({ error: "unauthorized" }, 401);
  }
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update?.update_id) return json({ ok: true });

  const fromId = String(update.message?.from?.id ?? update.callback_query?.from.id ?? "");
  // Only the owner can use the bot. Everyone else is ignored silently.
  if (fromId !== cfg.allowedUserId) return json({ ok: true });
  if (!(await claimUpdate(env.DB, update.update_id))) return json({ ok: true });

  const telegram = new Telegram(cfg.botToken, cfg.telegramApi);
  try {
    if (update.callback_query) await onButton(env, cfg, telegram, update.callback_query);
    else if (update.message?.text)
      await onText(env, cfg, telegram, String(update.message.chat.id), update.message.text.trim());
  } catch (e) {
    console.error(`[bot] ${String(e)}`);
    const chatId = String(update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? "");
    if (chatId) await telegram.sendMessage(chatId, "⚠️ Something went wrong on my side. Try again in a moment.");
  }
  return json({ ok: true });
}

async function onButton(
  env: Env,
  cfg: BotConfig,
  telegram: Telegram,
  q: NonNullable<TelegramUpdate["callback_query"]>,
) {
  const [verb, id] = (q.data ?? "").split(":");
  const chatId = String(q.message?.chat.id ?? "");
  if (!chatId || !id || (verb !== "yes" && verb !== "no")) return;
  if (q.message) await telegram.clearButtons(chatId, q.message.message_id);
  await decide(env, cfg, telegram, chatId, id, verb === "yes", q.id);
}

async function decide(
  env: Env,
  cfg: BotConfig,
  telegram: Telegram,
  chatId: string,
  id: string | null,
  confirmed: boolean,
  callbackId?: string,
  mergeAnyway = false,
) {
  const action = await takePending(env.DB, chatId, id, confirmed ? "done" : "cancelled");
  const reply = async (text: string) => {
    if (callbackId) await telegram.answerCallback(callbackId, text.replace(/<[^>]+>/g, ""));
    await telegram.sendMessage(chatId, text);
  };
  if (action === "expired") return reply("That confirmation expired (10 minutes). Ask again if you still want it.");
  if (!action) return reply("There is nothing waiting for confirmation.");
  if (!confirmed) return reply(`Cancelled: ${esc(action.summary)}`);

  const sensitive =
    action.kind === "merge_pr" && ((JSON.parse(action.payload) as { sensitive?: string[] }).sensitive ?? []).length > 0;
  if (sensitive && !mergeAnyway) {
    // A YES is not enough for pipeline/infra changes; put the action back so MERGE ANYWAY can still take it.
    await env.DB.prepare("UPDATE pending_actions SET status = 'pending' WHERE id = ?1").bind(action.id).run();
    return reply("This PR changes the deploy pipeline or infrastructure. Reply <b>MERGE ANYWAY</b> to merge it.");
  }
  await reply(await execute(env, cfg, action));
}

const REQ_ICON = { passing: "✅", failing: "❌", untested: "⚪" } as const;

async function sendPrepared(telegram: Telegram, chatId: string, prepared: Prepared) {
  if (!prepared.pending) return void (await telegram.sendMessage(chatId, esc(prepared.message)));
  await telegram.sendMessage(
    chatId,
    confirmText(prepared.pending, ""),
    confirmButtons(prepared.pending.id, isSensitive(prepared.pending)),
  );
}

const isSensitive = (p: PendingAction) =>
  ((JSON.parse(p.payload) as { sensitive?: string[] }).sensitive ?? []).length > 0;

function confirmText(p: PendingAction, lead: string) {
  return `${lead}${lead ? "\n\n" : ""}<b>Confirm:</b> ${esc(p.summary)}${isSensitive(p) ? "\n⚠️ Changes sensitive files. Reply <b>MERGE ANYWAY</b> to merge." : ""}`;
}

/** Plain-language explanation for Anthropic API errors the owner can act on, or null for anything else. */
function aiErrorMessage(e: unknown): string | null {
  if (!(e instanceof Anthropic.APIError)) return null;
  const shortcuts = "Shortcuts still work: /latest /runs /reqs /run /merge.";
  if (e.status === 400 && /credit balance/i.test(e.message))
    return `💳 The Anthropic API credit is too low, so I can't answer free-form messages right now. Add credit in the Anthropic Console under Billing. ${shortcuts}`;
  if (e.status === 401)
    return `🔑 The Anthropic API key was rejected. Run <code>npm run bot:setup</code> again with a valid key. ${shortcuts}`;
  if (e.status === 429 || e.status === 529 || (e.status ?? 0) >= 500)
    return `⏳ The Anthropic API is busy right now. Try again in a minute. ${shortcuts}`;
  return null;
}

async function onText(env: Env, cfg: BotConfig, telegram: Telegram, chatId: string, text: string) {
  const upper = text.toUpperCase();
  if (upper === "YES" || upper === "Y") return decide(env, cfg, telegram, chatId, null, true);
  if (upper === "MERGE ANYWAY") return decide(env, cfg, telegram, chatId, null, true, undefined, true);
  if (upper === "NO" || upper === "CANCEL") return decide(env, cfg, telegram, chatId, null, false);

  const command = text.split(/\s+/)[0]?.toLowerCase().replace(/@.*$/, "");
  if (command === "/start" || command === "/help") return void (await telegram.sendMessage(chatId, HELP));
  if (command === "/reset") {
    await forget(env.DB, chatId);
    return void (await telegram.sendMessage(chatId, "Conversation memory cleared."));
  }
  if (command === "/pending") {
    const pending = await listPending(env.DB, chatId);
    const body = pending.length
      ? pending.map((p) => `• ${esc(p.summary)}`).join("\n")
      : "Nothing is waiting for confirmation.";
    return void (await telegram.sendMessage(chatId, body));
  }
  const args = text.split(/\s+/).slice(1);
  if (command === "/run") return sendPrepared(telegram, chatId, await prepareRun(env, chatId, args.join(" ")));
  if (command === "/merge") {
    const repo = args[0]?.toLowerCase();
    const number = Number(args[1]);
    if (!(REPOS as readonly string[]).includes(repo ?? "") || !Number.isInteger(number) || number < 1) {
      return void (await telegram.sendMessage(
        chatId,
        `Usage: /merge &lt;repo&gt; &lt;number&gt;. Repos: ${REPOS.join(", ")}.`,
      ));
    }
    return sendPrepared(telegram, chatId, await prepareMerge(env, cfg, chatId, repo as Repo, number));
  }
  if (command === "/reqs") {
    const { requirements, issuesLoaded } = await listRequirements(env, "wealthlite");
    const lines = requirements.map((q) => {
      const failing = q.tests.filter((t) => t.status === "failed").length;
      const detail =
        q.state === "untested"
          ? "no tests yet"
          : q.state === "failing"
            ? `${failing} of ${q.tests.length} tests failing`
            : `${q.tests.length} tests passing`;
      const title = q.title ? esc(q.title) : "(story not found)";
      const link = q.url ? `<a href="${esc(q.url)}">${q.key}</a>` : q.key;
      return `${REQ_ICON[q.state]} ${link} ${title}: ${detail}${q.issueState === "closed" ? " (done)" : ""}`;
    });
    const body = [
      lines.length ? lines.join("\n") : "No stories yet. Create a Story in Jira project KAN.",
      issuesLoaded ? "" : "\n⚠️ Jira could not be reached, so titles may be missing.",
      `\n<a href="${cfg.publicUrl}/dashboard/#requirements">Open the coverage matrix</a>`,
    ].join("");
    return void (await telegram.sendMessage(chatId, body));
  }
  if (command === "/runs" || command === "/latest") {
    const runs = await listRuns(env.DB, "wealthlite", command === "/latest" ? 1 : 5);
    const body = runs.length
      ? runs
          .map(
            (r) =>
              `${r.status === "passed" ? "✅" : r.status === "failed" ? "❌" : "⏳"} ${r.counts.passed} passed · ${r.counts.failed} failed · ${r.counts.healed} healed — <a href="${cfg.publicUrl}/dashboard/run/?id=${r.id}">${esc((r.commitMessage ?? r.id).slice(0, 60))}</a>`,
          )
          .join("\n")
      : "No runs recorded yet.";
    return void (await telegram.sendMessage(chatId, body));
  }

  await telegram.sendTyping(chatId);
  await remember(env.DB, chatId, "user", text);
  let result;
  try {
    result = await respond(env, cfg, chatId, await history(env.DB, chatId));
  } catch (e) {
    const message = aiErrorMessage(e);
    if (!message) throw e;
    console.warn(`[bot] Anthropic API: ${String(e)}`);
    return void (await telegram.sendMessage(chatId, message));
  }
  await remember(env.DB, chatId, "assistant", result.text);
  let body = esc(result.text);
  let buttons: InlineButton[][] | undefined;
  if (result.pending) {
    body = confirmText(result.pending, body);
    buttons = confirmButtons(result.pending.id, isSensitive(result.pending));
  }
  await telegram.sendMessage(chatId, body, buttons);
}

interface BotEvent {
  kind?: unknown;
  story?: unknown;
  tests?: unknown;
  title?: unknown;
  passed?: unknown;
  failed?: unknown;
  request_id?: unknown;
  repo?: unknown;
  status?: unknown;
  pr_number?: unknown;
  pr_url?: unknown;
  summary?: unknown;
  run_url?: unknown;
}

/** POST /api/bot/events: called by a repo's claude-change workflow when it finishes. */
export async function handleBotEvent(request: Request, env: Env): Promise<Response> {
  const cfg = botConfig(env);
  if (!cfg?.eventsToken) return json({ error: "not_configured" }, 503);
  if (!(await isAuthorized(request, cfg.eventsToken))) return json({ error: "unauthorized" }, 401);
  const parsed = await readJson(request, 64 * 1024);
  if (!parsed.ok) return parsed.response;
  const event = parsed.body as BotEvent;
  if (event.kind === "requirement") return requirementEvent(env, cfg, event);
  const requestId = typeof event.request_id === "string" ? event.request_id : "";
  const change = requestId ? await getChangeRequest(env.DB, requestId) : null;
  if (!change) return json({ error: "unknown_request" }, 404);

  const telegram = new Telegram(cfg.botToken, cfg.telegramApi);
  const summary = typeof event.summary === "string" ? event.summary.slice(0, 1500) : "";
  const runLink = typeof event.run_url === "string" ? ` (<a href="${esc(event.run_url)}">log</a>)` : "";

  if (event.status === "pr_opened" && typeof event.pr_number === "number" && typeof event.pr_url === "string") {
    await updateChangeRequest(env.DB, requestId, "pr_opened", { number: event.pr_number, url: event.pr_url });
    let files = "";
    if (cfg.githubToken) {
      const pr = await new GitHub(cfg.githubToken, cfg.githubOwner, cfg.githubApi)
        .pr(change.repo, event.pr_number)
        .catch(() => null);
      if (pr) {
        const sensitive = sensitiveFiles(pr.files);
        files = `\nFiles: ${pr.files
          .slice(0, 8)
          .map((f) => `<code>${esc(f)}</code>`)
          .join(", ")}${pr.files.length > 8 ? " …" : ""}`;
        if (sensitive.length) files += "\n⚠️ Touches sensitive files; merging will need MERGE ANYWAY.";
      }
    }
    await telegram.sendMessage(
      change.chat_id,
      `🔀 <b>${esc(change.repo)} PR #${event.pr_number}</b> is ready: <a href="${esc(event.pr_url)}">open on GitHub</a>${files}\n\n${esc(summary)}\n\nChecks are running. Say "merge it" when you're happy, or "close it".`,
    );
  } else if (event.status === "no_changes") {
    await updateChangeRequest(env.DB, requestId, "no_changes");
    await telegram.sendMessage(
      change.chat_id,
      `ℹ️ No changes were needed in ${esc(change.repo)}${runLink}. ${esc(summary)}`,
    );
  } else {
    await updateChangeRequest(env.DB, requestId, "failed");
    await telegram.sendMessage(
      change.chat_id,
      `⚠️ The change in ${esc(change.repo)} failed${runLink}. ${esc(summary)}`,
    );
  }
  // Keep the conversation aware of the PR so "merge it" works.
  if (event.status === "pr_opened") {
    await remember(
      env.DB,
      change.chat_id,
      "assistant",
      `Opened ${change.repo} PR #${String(event.pr_number)} (${String(event.pr_url)}) for: ${change.instruction}`,
    );
  }
  return json({ ok: true });
}

/**
 * Test issues of a Jira story were labelled for a suite and qa-tests automated them (automate-from-jira.yml).
 * There is no chat request behind it, so the message goes to the owner's private chat.
 */
async function requirementEvent(env: Env, cfg: BotConfig, event: BotEvent): Promise<Response> {
  const story = typeof event.story === "string" && /^KAN-\d{1,6}$/.test(event.story) ? event.story : null;
  if (!story) return json({ error: "invalid_body", message: "story must be a Jira key like KAN-6" }, 400);
  const tests =
    typeof event.tests === "string" && /^(KAN-\d{1,6})(,KAN-\d{1,6})*$/.test(event.tests)
      ? `\nTest issues: ${event.tests.split(",").join(", ")}`
      : "";
  const title = typeof event.title === "string" ? event.title.slice(0, 200) : "";
  const summary = typeof event.summary === "string" ? event.summary.slice(0, 1500) : "";
  const runLink = typeof event.run_url === "string" ? ` (<a href="${esc(event.run_url)}">log</a>)` : "";
  const counts =
    typeof event.passed === "number" && typeof event.failed === "number"
      ? `Against live wealthlite: ${event.passed} passed · ${event.failed} failed.`
      : "";
  const head = `📋 <b>Story ${story}</b>${title ? `: ${esc(title)}` : ""}${tests}`;
  const telegram = new Telegram(cfg.botToken, cfg.telegramApi);
  const chatId = cfg.allowedUserId;

  if (
    (event.status === "pr_opened" || event.status === "pr_updated") &&
    typeof event.pr_number === "number" &&
    typeof event.pr_url === "string"
  ) {
    const verb = event.status === "pr_opened" ? "Tests automated in" : "Tests updated in";
    const failingNote =
      typeof event.failed === "number" && event.failed > 0
        ? "\nFailing tests are expected until wealthlite implements the story."
        : "";
    await telegram.sendMessage(
      chatId,
      `${head}\n${verb} <a href="${esc(event.pr_url)}">qa-tests PR #${event.pr_number}</a>.\n${counts}${failingNote}\n\n${esc(summary)}\n\nWhen checks pass: /merge qa-tests ${event.pr_number}`,
    );
    await remember(
      env.DB,
      chatId,
      "assistant",
      `Story ${story} (${title}): tests in qa-tests PR #${event.pr_number} (${event.pr_url}). ${counts}`,
    );
  } else if (event.status === "no_changes") {
    await telegram.sendMessage(chatId, `${head}\nNo test changes were needed${runLink}. ${esc(summary)}`);
  } else {
    await telegram.sendMessage(chatId, `${head}\n⚠️ Automating the tests failed${runLink}. ${esc(summary)}`);
  }
  return json({ ok: true });
}
