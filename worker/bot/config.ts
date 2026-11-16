// Bot configuration from Worker secrets and vars. Every part of the bot checks `isConfigured`
// first, so previews and local runs without secrets keep working (the bot is simply off).

export interface BotConfig {
  botToken: string;
  webhookSecret: string;
  allowedUserId: string;
  reportChatId: string | null;
  anthropicKey: string;
  githubToken: string | null;
  eventsToken: string | null;
  githubOwner: string;
  publicUrl: string;
  telegramApi: string;
  githubApi: string;
  anthropicBaseUrl: string | undefined;
}

export const REPOS = ["wealthlite", "qa-tests", "portfolio"] as const;
export type Repo = (typeof REPOS)[number];

export function botConfig(env: Env): BotConfig | null {
  const e = env as unknown as Record<string, string | undefined>;
  const required = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_ALLOWED_USER_ID", "ANTHROPIC_API_KEY"];
  if (required.some((k) => !e[k])) return null;
  return {
    botToken: e.TELEGRAM_BOT_TOKEN as string,
    webhookSecret: e.TELEGRAM_WEBHOOK_SECRET as string,
    allowedUserId: e.TELEGRAM_ALLOWED_USER_ID as string,
    reportChatId: e.TELEGRAM_REPORT_CHAT_ID || null,
    anthropicKey: e.ANTHROPIC_API_KEY as string,
    githubToken: e.GITHUB_BOT_TOKEN || null,
    eventsToken: e.BOT_EVENTS_TOKEN || null,
    githubOwner: e.GITHUB_OWNER || "aswinrajmk",
    publicUrl: (e.PUBLIC_URL || "https://portfolio.aswin-qa.workers.dev").replace(/\/$/, ""),
    // Overridable so local tests can point every external call at a stub server.
    telegramApi: (e.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, ""),
    githubApi: (e.GITHUB_API_BASE || "https://api.github.com").replace(/\/$/, ""),
    anthropicBaseUrl: e.ANTHROPIC_BASE_URL || undefined,
  };
}

/** Channel reports only need the bot token and a report chat. */
export function reportConfig(
  env: Env,
): { botToken: string; chatId: string; telegramApi: string; publicUrl: string } | null {
  const e = env as unknown as Record<string, string | undefined>;
  if (!e.TELEGRAM_BOT_TOKEN || !e.TELEGRAM_REPORT_CHAT_ID) return null;
  return {
    botToken: e.TELEGRAM_BOT_TOKEN,
    chatId: e.TELEGRAM_REPORT_CHAT_ID,
    telegramApi: (e.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, ""),
    publicUrl: (e.PUBLIC_URL || "https://portfolio.aswin-qa.workers.dev").replace(/\/$/, ""),
  };
}
