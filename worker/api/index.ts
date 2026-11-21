import { LIMITS, validateRunFinish, validateRunStart, validateTestResult } from "../../shared/results";
import { postRunReport } from "../bot/report";
import { error, isAuthorized, json, readJson } from "./http";
import { getMetrics } from "./metrics";
import { listRequirements } from "./requirements";
import { addResult, createRun, finishRun, getRun, getScreenshot, listRuns, runState } from "./store";

const ID = "[0-9a-f-]{36}";
const ROUTES = {
  runResults: new RegExp(`^/api/runs/(${ID})/results$`),
  runFinish: new RegExp(`^/api/runs/(${ID})/finish$`),
  run: new RegExp(`^/api/runs/(${ID})$`),
  screenshot: new RegExp(`^/api/results/(${ID})/screenshot$`),
};

export async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, environment: env.ENVIRONMENT });
  }

  if (method === "GET") {
    if (path === "/api/runs") {
      const project = url.searchParams.get("project") ?? "wealthlite";
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 10, 1), LIMITS.runsPerPage);
      return json({ runs: await listRuns(env.DB, project, limit) });
    }
    if (path === "/api/runs/latest") {
      const project = url.searchParams.get("project") ?? "wealthlite";
      const [latest] = await listRuns(env.DB, project, 1);
      return latest ? json(latest) : error(404, "no_runs", "No runs recorded yet");
    }
    if (path === "/api/requirements") {
      // Only the demo app has requirement issues; the project is fixed so callers cannot point this at other repos.
      return json(await listRequirements(env, "wealthlite"));
    }
    if (path === "/api/metrics") {
      // Fixed project, like /api/requirements.
      return json(await getMetrics(env, "wealthlite"));
    }
    const runMatch = ROUTES.run.exec(path);
    if (runMatch?.[1]) {
      const run = await getRun(env.DB, runMatch[1]);
      return run ? json(run) : error(404, "not_found", "Run not found");
    }
    const shotMatch = ROUTES.screenshot.exec(path);
    if (shotMatch?.[1]) {
      const image = await getScreenshot(env.DB, shotMatch[1]);
      if (!image) return error(404, "not_found", "Screenshot not found");
      return new Response(image, {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
      });
    }
  }

  if (method === "POST") {
    if (!(await isAuthorized(request, env.RESULTS_API_TOKEN))) {
      return error(401, "unauthorized", "A valid bearer token is required");
    }
    const parsed = await readJson(request, LIMITS.bodyBytes);
    if (!parsed.ok) return parsed.response;

    if (path === "/api/runs") {
      const input = validateRunStart(parsed.body);
      if (!input.ok) return error(400, "invalid_body", input.error);
      return json({ id: await createRun(env.DB, input.value) }, 201);
    }

    const resultsMatch = ROUTES.runResults.exec(path);
    if (resultsMatch?.[1]) {
      const runId = resultsMatch[1];
      const state = await runState(env.DB, runId);
      if (!state) return error(404, "not_found", "Run not found");
      if (state !== "running") return error(409, "run_finished", "Run is already finished");
      const input = validateTestResult(parsed.body);
      if (!input.ok) return error(400, "invalid_body", input.error);
      let screenshot: Uint8Array | null = null;
      if (input.value.screenshot) {
        screenshot = Uint8Array.from(atob(input.value.screenshot), (c) => c.charCodeAt(0));
        const isJpeg = screenshot[0] === 0xff && screenshot[1] === 0xd8 && screenshot[2] === 0xff;
        if (!isJpeg) return error(400, "invalid_body", "screenshot must be a JPEG");
        if (screenshot.byteLength > LIMITS.screenshotBytes) {
          return error(413, "too_large", `screenshot is larger than ${LIMITS.screenshotBytes} bytes`);
        }
      }
      return json({ id: await addResult(env.DB, runId, input.value, screenshot) }, 201);
    }

    const finishMatch = ROUTES.runFinish.exec(path);
    if (finishMatch?.[1]) {
      const runId = finishMatch[1];
      const state = await runState(env.DB, runId);
      if (!state) return error(404, "not_found", "Run not found");
      const input = validateRunFinish(parsed.body);
      if (!input.ok) return error(400, "invalid_body", input.error);
      const status = await finishRun(env.DB, runId, input.value.interrupted ?? false);
      // Post the report to the Telegram channel after responding, so the reporter is never slowed down.
      ctx.waitUntil(postRunReport(env, runId));
      return json({ id: runId, status });
    }
  }

  return error(404, "not_found", "No such API route");
}
