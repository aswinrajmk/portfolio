// Creates or completes .dev.vars (gitignored) with local-only values.
// The bot values point every external API at the local stub server used by tests (tests/bot/stub-server.mjs).
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = ".dev.vars";
const STUB = "http://localhost:4199";
const defaults = {
  RESULTS_API_TOKEN: randomBytes(16).toString("hex"),
  TELEGRAM_BOT_TOKEN: "local-test-bot-token",
  TELEGRAM_WEBHOOK_SECRET: "local-test-webhook-secret",
  TELEGRAM_ALLOWED_USER_ID: "4242",
  TELEGRAM_REPORT_CHAT_ID: "-100999",
  ANTHROPIC_API_KEY: "local-test-anthropic-key",
  GITHUB_BOT_TOKEN: "local-test-github-token",
  BOT_EVENTS_TOKEN: "local-test-events-token",
  TELEGRAM_API_BASE: STUB,
  GITHUB_API_BASE: STUB,
  ANTHROPIC_BASE_URL: STUB,
};

let current = existsSync(file) ? readFileSync(file, "utf8") : "";
const added = [];
for (const [key, value] of Object.entries(defaults)) {
  if (!new RegExp(`^${key}=`, "m").test(current)) {
    current += `${current && !current.endsWith("\n") ? "\n" : ""}${key}=${value}\n`;
    added.push(key);
  }
}
if (added.length) {
  writeFileSync(file, current);
  console.log(`Added local values to .dev.vars: ${added.join(", ")}`);
}
