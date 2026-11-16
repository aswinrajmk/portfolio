#!/usr/bin/env node
// One-time Telegram bot setup. Run it yourself in a terminal: `npm run bot:setup`.
// It asks for each token with hidden input, checks it, then stores it as a Cloudflare Worker secret and as
// GitHub repository secrets. Secrets are never printed, logged or written anywhere except a temporary
// file (mode 600) that is deleted straight after `wrangler secret bulk` reads it.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const OWNER = "aswinrajmk";
const REPOS = ["portfolio", "wealthlite", "qa-tests"];
const WEBHOOK_URL = "https://portfolio.aswin-qa.workers.dev/telegram/webhook";

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(s);
        else if (s.includes("\n") || s.includes("\r")) process.stdout.write("\n");
        else process.stdout.write("*");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function telegram(token, method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description}`);
  return json.result;
}

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  if (result.status !== 0)
    throw new Error(`${cmd} ${args.slice(0, 3).join(" ")} failed: ${(result.stderr || "").slice(0, 300)}`);
  return result.stdout;
}

const step = (n, text) => console.log(`\n\x1b[1m${n}. ${text}\x1b[0m`);

async function main() {
  console.log("Telegram bot setup for the portfolio QA bot. Secrets you type are hidden and never printed.");

  step(1, "Telegram bot token (from @BotFather)");
  const botToken = await ask("Paste the bot token: ", { hidden: true });
  const me = await telegram(botToken, "getMe");
  console.log(`   Connected to @${me.username}.`);
  await telegram(botToken, "deleteWebhook", { drop_pending_updates: false });

  step(2, "Find your user ID and the report channel");
  let users = new Map();
  let channels = new Map();
  for (;;) {
    const updates = await telegram(botToken, "getUpdates", {
      allowed_updates: ["message", "channel_post", "my_chat_member"],
    });
    for (const u of updates) {
      const m = u.message;
      if (m?.chat?.type === "private" && m.from) users.set(String(m.from.id), m.from.first_name ?? "you");
      const c = u.channel_post?.chat ?? u.my_chat_member?.chat;
      if (c?.type === "channel") channels.set(String(c.id), c.title ?? "channel");
    }
    if (users.size && channels.size) break;
    console.log(`   Found ${users.size} private chat(s) and ${channels.size} channel(s).`);
    console.log(`   Send /start to @${me.username}, and post any message in the channel where the bot is an admin.`);
    await ask("   Press Enter to check again… ");
  }
  const pick = async (label, map) => {
    const entries = [...map.entries()];
    if (entries.length === 1) return entries[0][0];
    entries.forEach(([id, name], i) => console.log(`   ${i + 1}) ${name} (${id})`));
    const choice = Number(await ask(`   Which ${label}? `));
    return entries[choice - 1]?.[0] ?? entries[0][0];
  };
  const userId = await pick("user is you", users);
  const channelId = await pick("channel gets the reports", channels);
  console.log(`   You: ${userId}. Report channel: ${channels.get(channelId)} (${channelId}).`);

  step(3, "Anthropic API key for the bot's chat");
  const anthropicKey = await ask("Paste the Anthropic API key: ", { hidden: true });
  const check = await fetch("https://api.anthropic.com/v1/models", {
    headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
  });
  if (!check.ok) throw new Error(`The Anthropic key was rejected (${check.status}).`);
  console.log("   Key works.");

  step(4, "GitHub token for the bot (fine-grained, 3 repos)");
  const githubToken = await ask("Paste the GitHub token: ", { hidden: true });
  for (const repo of REPOS) {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}`, {
      headers: { Authorization: `Bearer ${githubToken}`, "User-Agent": "bot-setup" },
    });
    const body = await res.json();
    if (!res.ok || !body.permissions?.push) throw new Error(`The GitHub token cannot write to ${repo}.`);
  }
  console.log("   Token can write to portfolio, wealthlite and qa-tests.");

  step(5, "How should code changes pay for Claude?");
  console.log("   1) Use the same Anthropic API key (pay as you go)");
  console.log("   2) Use my Claude subscription (paste a token from `claude setup-token`)");
  const billing = (await ask("   Choose 1 or 2: ")) === "2" ? "oauth" : "api";
  const oauthToken = billing === "oauth" ? await ask("Paste the Claude Code OAuth token: ", { hidden: true }) : null;

  step(6, "Saving secrets");
  const webhookSecret = randomBytes(32).toString("hex");
  const eventsToken = randomBytes(32).toString("hex");
  const dir = mkdtempSync(join(tmpdir(), "bot-setup-"));
  const file = join(dir, "secrets.json");
  try {
    writeFileSync(
      file,
      JSON.stringify({
        TELEGRAM_BOT_TOKEN: botToken,
        TELEGRAM_WEBHOOK_SECRET: webhookSecret,
        TELEGRAM_ALLOWED_USER_ID: userId,
        TELEGRAM_REPORT_CHAT_ID: channelId,
        ANTHROPIC_API_KEY: anthropicKey,
        GITHUB_BOT_TOKEN: githubToken,
        BOT_EVENTS_TOKEN: eventsToken,
      }),
      { mode: 0o600 },
    );
    run("npx", ["wrangler", "secret", "bulk", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log("   Cloudflare Worker secrets saved (7).");

  for (const repo of REPOS) {
    const set = (name, value) => run("gh", ["secret", "set", name, "--repo", `${OWNER}/${repo}`], value);
    set("BOT_GITHUB_TOKEN", githubToken);
    set("BOT_EVENTS_TOKEN", eventsToken);
    if (billing === "oauth") set("CLAUDE_CODE_OAUTH_TOKEN", oauthToken);
    else set("ANTHROPIC_API_KEY", anthropicKey);
    console.log(`   GitHub secrets saved in ${repo}.`);
  }

  step(7, "Connecting Telegram to the Worker");
  await telegram(botToken, "setWebhook", {
    url: WEBHOOK_URL,
    secret_token: webhookSecret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await telegram(botToken, "sendMessage", { chat_id: userId, text: "✅ Connected. Send /help to see what I can do." });
  await telegram(botToken, "sendMessage", { chat_id: channelId, text: "✅ QA run reports will be posted here." });
  console.log("   Done. Check Telegram: the bot and the channel each have a message.");
}

main().catch((e) => {
  console.error(`\nSetup stopped: ${e.message}`);
  process.exit(1);
});
