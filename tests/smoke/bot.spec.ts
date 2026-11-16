import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Telegram bot tests. Local only: the Worker's Telegram, GitHub and Anthropic calls go to the stub server
// (tests/bot/stub-server.mjs), and confirmations are exercised end to end without touching real services.
test.skip(!!process.env.BASE_URL, "Bot tests use the local stub server");
test.describe.configure({ mode: "serial" });

const STUB = "http://localhost:4199";
const vars = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const OWNER = Number(vars.TELEGRAM_ALLOWED_USER_ID);
const SECRET = vars.TELEGRAM_WEBHOOK_SECRET;
const REPORT_CHAT = vars.TELEGRAM_REPORT_CHAT_ID;

interface StubRequest {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

let updateId = Date.now();
const nextId = () => ++updateId;

async function stub(request: APIRequestContext) {
  return (await (await request.get(`${STUB}/__requests`)).json()) as StubRequest[];
}

/** Telegram messages the bot sent to a given chat. */
async function sentTo(request: APIRequestContext, chatId: string | number) {
  return (await stub(request)).filter(
    (r) => r.path.endsWith("/sendMessage") && String(r.body?.chat_id) === String(chatId),
  );
}

function say(request: APIRequestContext, text: string, from = OWNER) {
  return request.post("/telegram/webhook", {
    headers: { "X-Telegram-Bot-Api-Secret-Token": SECRET },
    data: {
      update_id: nextId(),
      message: { message_id: 1, chat: { id: from, type: "private" }, from: { id: from }, text },
    },
  });
}

function tap(request: APIRequestContext, data: string) {
  return request.post("/telegram/webhook", {
    headers: { "X-Telegram-Bot-Api-Secret-Token": SECRET },
    data: {
      update_id: nextId(),
      callback_query: { id: "cb1", from: { id: OWNER }, data, message: { message_id: 77, chat: { id: OWNER } } },
    },
  });
}

const toolUse = (name: string, input: object) => ({
  content: [{ type: "tool_use", id: `toolu_${name}_${Date.now()}`, name, input }],
  stop_reason: "tool_use",
});
const reply = (text: string) => ({ content: [{ type: "text", text }], stop_reason: "end_turn" });

test.beforeEach(async ({ request }) => {
  await request.post(`${STUB}/__reset`);
  await say(request, "/reset");
  await request.post(`${STUB}/__reset`);
});

test("rejects webhook calls without the secret token", async ({ request }) => {
  const none = await request.post("/telegram/webhook", { data: { update_id: nextId() } });
  expect(none.status()).toBe(401);
  const wrong = await request.post("/telegram/webhook", {
    headers: { "X-Telegram-Bot-Api-Secret-Token": "wrong" },
    data: { update_id: nextId() },
  });
  expect(wrong.status()).toBe(401);
});

test("ignores everyone except the owner", async ({ request }) => {
  const response = await say(request, "/latest", 1234);
  expect(response.status()).toBe(200);
  expect(await sentTo(request, 1234)).toEqual([]);
  expect((await stub(request)).filter((r) => r.path === "/v1/messages")).toEqual([]);
});

test("processes a redelivered update only once", async ({ request }) => {
  const id = nextId();
  const body = {
    update_id: id,
    message: { message_id: 1, chat: { id: OWNER, type: "private" }, from: { id: OWNER }, text: "/help" },
  };
  const headers = { "X-Telegram-Bot-Api-Secret-Token": SECRET };
  await request.post("/telegram/webhook", { headers, data: body });
  await request.post("/telegram/webhook", { headers, data: body });
  expect(await sentTo(request, OWNER)).toHaveLength(1);
});

test("answers a question using the run tools", async ({ request }) => {
  await request.post(`${STUB}/__anthropic`, {
    data: { responses: [toolUse("list_runs", { limit: 1 }), reply("The last run passed: 12 of 12 tests.")] },
  });
  await say(request, "How did the last run go?");

  const calls = (await stub(request)).filter((r) => r.path === "/v1/messages");
  expect(calls).toHaveLength(2);
  const second = calls[1]?.body as { messages: { role: string; content: unknown }[] };
  expect(JSON.stringify(second.messages.at(-1))).toContain("tool_result");

  const messages = await sentTo(request, OWNER);
  expect(String(messages.at(-1)?.body?.text)).toContain("The last run passed: 12 of 12 tests.");
});

test("a code change waits for YES, then dispatches the repo workflow and reports the PR", async ({ request }) => {
  const instruction = "In src/LoginPage.tsx change SIGN_IN_LABEL from Sign in to Log in.";
  await request.post(`${STUB}/__anthropic`, {
    data: {
      responses: [
        toolUse("request_code_change", { repo: "wealthlite", instruction }),
        reply("I'll rename the button once you confirm."),
      ],
    },
  });
  await say(request, "Rename the sign-in button to Log in");

  // Nothing is dispatched before confirmation, and the reply carries YES/Cancel buttons.
  expect((await stub(request)).filter((r) => r.path.endsWith("/dispatches"))).toHaveLength(0);
  const confirm = (await sentTo(request, OWNER)).at(-1)?.body as {
    reply_markup: { inline_keyboard: { callback_data: string }[][] };
  };
  const yes = confirm.reply_markup.inline_keyboard[0]?.find((b) => b.callback_data.startsWith("yes:"));
  expect(yes).toBeTruthy();

  await tap(request, yes?.callback_data ?? "");
  const dispatches = (await stub(request)).filter((r) => r.path.endsWith("/dispatches"));
  expect(dispatches).toHaveLength(1);
  expect(dispatches[0]?.path).toBe("/repos/aswinrajmk/wealthlite/actions/workflows/claude-change.yml/dispatches");
  const inputs = (dispatches[0]?.body as { inputs: { instruction: string; request_id: string } }).inputs;
  expect(inputs.instruction).toBe(instruction);

  // A second tap must not run it again.
  await tap(request, yes?.callback_data ?? "");
  expect((await stub(request)).filter((r) => r.path.endsWith("/dispatches"))).toHaveLength(1);

  // The workflow calls back with the PR.
  const unauthorised = await request.post("/api/bot/events", {
    data: { request_id: inputs.request_id, status: "pr_opened" },
  });
  expect(unauthorised.status()).toBe(401);
  const event = await request.post("/api/bot/events", {
    headers: { Authorization: `Bearer ${vars.BOT_EVENTS_TOKEN}` },
    data: {
      request_id: inputs.request_id,
      status: "pr_opened",
      pr_number: 7,
      pr_url: "https://github.com/aswinrajmk/wealthlite/pull/7",
      summary: "Renamed the button.",
    },
  });
  expect(event.status()).toBe(200);
  expect(String((await sentTo(request, OWNER)).at(-1)?.body?.text)).toContain("PR #7");
});

test("cancel stops a pending action", async ({ request }) => {
  await request.post(`${STUB}/__anthropic`, {
    data: { responses: [toolUse("start_qa_run", {}), reply("Starting once you confirm.")] },
  });
  await say(request, "Run the tests");
  await say(request, "cancel");
  expect((await stub(request)).filter((r) => r.path.endsWith("/dispatches"))).toHaveLength(0);
  expect(String((await sentTo(request, OWNER)).at(-1)?.body?.text)).toContain("Cancelled");
});

test("merging is refused while checks fail", async ({ request }) => {
  await request.post(`${STUB}/__github`, {
    data: { checkRuns: [{ name: "verify", status: "completed", conclusion: "failure" }] },
  });
  await request.post(`${STUB}/__anthropic`, {
    data: {
      responses: [
        toolUse("merge_pr", { repo: "wealthlite", number: 7 }),
        reply("Checks are failing, so I can't merge."),
      ],
    },
  });
  await say(request, "merge it");
  const anthropic = (await stub(request)).filter((r) => r.path === "/v1/messages");
  expect(JSON.stringify(anthropic[1]?.body)).toContain("failing checks verify");
  expect((await sentTo(request, OWNER)).at(-1)?.body?.reply_markup).toBeUndefined();
});

test("sensitive merges need MERGE ANYWAY, and merge the confirmed commit", async ({ request }) => {
  await request.post(`${STUB}/__github`, { data: { files: [".github/workflows/deploy.yml"] } });
  await request.post(`${STUB}/__anthropic`, {
    data: {
      responses: [toolUse("merge_pr", { repo: "portfolio", number: 9 }), reply("This needs a second confirmation.")],
    },
  });
  await say(request, "merge portfolio PR 9");
  await say(request, "YES");
  expect((await stub(request)).filter((r) => r.path.endsWith("/merge"))).toHaveLength(0);

  await say(request, "MERGE ANYWAY");
  const merges = (await stub(request)).filter((r) => r.path.endsWith("/merge"));
  expect(merges).toHaveLength(1);
  expect(merges[0]?.body).toMatchObject({ merge_method: "squash", sha: "abc123def456" });
});

test("posts a report to the channel when a run finishes", async ({ request }) => {
  const auth = { Authorization: `Bearer ${vars.RESULTS_API_TOKEN}` };
  const start = await request.post("/api/runs", {
    headers: auth,
    data: {
      project: "wealthlite",
      trigger: "deploy",
      targetUrl: "http://localhost:8787",
      commitSha: "abc1234",
      commitMessage: "Bot test",
    },
  });
  const { id } = (await start.json()) as { id: string };
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64");
  await request.post(`/api/runs/${id}/results`, {
    headers: auth,
    data: {
      title: "copy test",
      file: "copy.spec.ts",
      status: "failed",
      durationMs: 5,
      error: { message: "Expected Sign in" },
      screenshot: jpeg,
    },
  });
  await request.post(`/api/runs/${id}/finish`, { headers: auth });

  await expect
    .poll(async () =>
      (await sentTo(request, REPORT_CHAT)).some((m) => String(m.body?.text).includes(`/dashboard/run/?id=${id}`)),
    )
    .toBe(true);
  await expect.poll(async () => (await stub(request)).some((r) => r.path.endsWith("/sendPhoto"))).toBe(true);
});

test("/run with a filter waits for YES, then dispatches the suite with --grep", async ({ request }) => {
  await say(request, "/run @REQ-3");
  const confirm = (await sentTo(request, OWNER)).at(-1)?.body as {
    text: string;
    reply_markup: { inline_keyboard: { callback_data: string }[][] };
  };
  expect(confirm.text).toContain("@REQ-3");
  expect((await stub(request)).filter((r) => r.path === "/v1/messages")).toEqual([]);
  await say(request, "YES");
  const dispatches = (await stub(request)).filter((r) => r.path.endsWith("/dispatches"));
  expect(dispatches).toHaveLength(1);
  expect(dispatches[0]?.path).toBe("/repos/aswinrajmk/qa-tests/actions/workflows/qa.yml/dispatches");
  expect(dispatches[0]?.body).toMatchObject({ inputs: { grep: "@REQ-3" } });
});

test("/run refuses filters with shell characters", async ({ request }) => {
  await say(request, "/run login; rm -rf /");
  expect(String((await sentTo(request, OWNER)).at(-1)?.body?.text)).toContain("not allowed");
  await say(request, "YES");
  expect((await stub(request)).filter((r) => r.path.endsWith("/dispatches"))).toHaveLength(0);
});

test("/merge checks the PR and merges after YES without using AI", async ({ request }) => {
  await say(request, "/merge qa-tests 12");
  await say(request, "YES");
  const merges = (await stub(request)).filter((r) => r.path.endsWith("/merge"));
  expect(merges).toHaveLength(1);
  expect(merges[0]?.path).toBe("/repos/aswinrajmk/qa-tests/pulls/12/merge");
  expect((await stub(request)).filter((r) => r.path === "/v1/messages")).toEqual([]);
});

test("/reqs lists requirement coverage", async ({ request }) => {
  await say(request, "/reqs");
  const text = String((await sentTo(request, OWNER)).at(-1)?.body?.text);
  expect(text).toContain("Sign in with email and password");
  expect(text).toContain("/dashboard/#requirements");
});

test("explains a low Anthropic credit balance instead of a generic error", async ({ request }) => {
  await request.post(`${STUB}/__anthropicError`, {
    data: { status: 400, message: "Your credit balance is too low to access the Anthropic API." },
  });
  await say(request, "How did the last run go?");
  const text = String((await sentTo(request, OWNER)).at(-1)?.body?.text);
  expect(text).toContain("credit is too low");
  expect(text).toContain("/latest");
});

test("a requirement event tells the owner about the drafted tests", async ({ request }) => {
  const post = (data: object, token = vars.BOT_EVENTS_TOKEN) =>
    request.post("/api/bot/events", { headers: { Authorization: `Bearer ${token}` }, data });
  expect((await post({ kind: "requirement", issue: 5 }, "wrong")).status()).toBe(401);
  expect((await post({ kind: "requirement", issue: "5" })).status()).toBe(400);
  const ok = await post({
    kind: "requirement",
    issue: 5,
    title: "Show a total gain or loss",
    status: "pr_opened",
    pr_number: 14,
    pr_url: "https://github.com/aswinrajmk/qa-tests/pull/14",
    passed: 1,
    failed: 2,
    summary: "Added three tests for the gain/loss figure.",
  });
  expect(ok.status()).toBe(200);
  const text = String((await sentTo(request, OWNER)).at(-1)?.body?.text);
  expect(text).toContain("Requirement #5");
  expect(text).toContain("1 passed · 2 failed");
  expect(text).toContain("/merge qa-tests 14");
});
