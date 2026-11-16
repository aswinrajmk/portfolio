// Local stand-in for the Telegram, GitHub and Anthropic APIs, used only by the bot tests.
// It records every request and replays scripted Anthropic responses, so tests never reach real services.
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 4199);
let requests = [];
let anthropicQueue = [];
let checkRuns = [{ name: "verify", status: "completed", conclusion: "success" }];
let prFiles = [{ filename: "src/LoginPage.tsx" }];

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

const message = (content, stop_reason) => ({
  id: `msg_${Math.random().toString(36).slice(2)}`,
  type: "message",
  role: "assistant",
  model: "claude-opus-5",
  content,
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  let body = null;
  const type = req.headers["content-type"] ?? "";
  if (type.includes("application/json") && raw.length) body = JSON.parse(raw.toString("utf8"));
  else if (raw.length) body = { _raw: raw.toString("latin1").slice(0, 2000) };

  // Control endpoints for tests
  if (path === "/__requests") return send(res, 200, requests);
  if (path === "/__reset") {
    requests = [];
    anthropicQueue = [];
    checkRuns = [{ name: "verify", status: "completed", conclusion: "success" }];
    prFiles = [{ filename: "src/LoginPage.tsx" }];
    return send(res, 200, { ok: true });
  }
  if (path === "/__anthropic") {
    anthropicQueue.push(...body.responses);
    return send(res, 200, { ok: true });
  }
  if (path === "/__github") {
    if (body.checkRuns) checkRuns = body.checkRuns;
    if (body.files) prFiles = body.files.map((filename) => ({ filename }));
    return send(res, 200, { ok: true });
  }

  requests.push({ method: req.method, path, query: url.search, body });

  // Anthropic Messages API
  if (path === "/v1/messages") {
    const next = anthropicQueue.shift() ?? { content: [{ type: "text", text: "stub reply" }], stop_reason: "end_turn" };
    return send(res, 200, message(next.content, next.stop_reason));
  }

  // Telegram Bot API: /bot<token>/<method>
  const tg = /^\/bot[^/]+\/(\w+)$/.exec(path);
  if (tg) return send(res, 200, { ok: true, result: tg[1] === "sendMessage" ? { message_id: 77 } : true });

  // GitHub REST API
  let m;
  if (req.method === "POST" && /\/actions\/workflows\/[^/]+\/dispatches$/.test(path)) return send(res, 204);
  if ((m = /^\/repos\/[^/]+\/([^/]+)\/pulls\/(\d+)\/files$/.exec(path))) return send(res, 200, prFiles);
  if ((m = /^\/repos\/[^/]+\/([^/]+)\/pulls\/(\d+)\/merge$/.exec(path))) return send(res, 200, { merged: true });
  if ((m = /^\/repos\/[^/]+\/([^/]+)\/pulls\/(\d+)$/.exec(path))) {
    if (req.method === "PATCH") return send(res, 200, { state: "closed" });
    return send(res, 200, {
      number: Number(m[2]),
      title: "Rename sign-in button",
      html_url: `https://github.com/aswinrajmk/${m[1]}/pull/${m[2]}`,
      state: "open",
      merged: false,
      head: { sha: "abc123def456" },
    });
  }
  if (/\/commits\/[^/]+\/check-runs$/.test(path)) return send(res, 200, { check_runs: checkRuns });
  if (/\/pulls$/.test(path)) return send(res, 200, []);

  send(res, 404, { error: "stub: unknown route", path });
}).listen(PORT, () => console.log(`stub listening on ${PORT}`));
