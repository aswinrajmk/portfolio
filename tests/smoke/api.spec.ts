import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Read-only checks run everywhere. Write checks run only against the local server (BASE_URL unset),
// so this suite never writes test data to production or preview databases.
const isLocal = !process.env.BASE_URL;

function localToken(name = "RESULTS_API_TOKEN"): string {
  const line = readFileSync(".dev.vars", "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing from .dev.vars`);
  return line.slice(name.length + 1).trim();
}

const PROJECT = "api-spec";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString("base64");

test.describe("Results API: read", () => {
  test("health reports the environment", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, environment: expect.any(String) });
  });

  test("latest run is either a run or a clear 404", async ({ request }) => {
    const response = await request.get("/api/runs/latest");
    expect([200, 404]).toContain(response.status());
    const body = await response.json();
    if (response.status() === 404) expect(body).toMatchObject({ error: "no_runs" });
    else expect(body).toMatchObject({ id: expect.any(String), status: expect.any(String), counts: expect.any(Object) });
  });

  test("run list caps the page size", async ({ request }) => {
    const response = await request.get("/api/runs?limit=999");
    expect(response.status()).toBe(200);
    const { runs } = (await response.json()) as { runs: unknown[] };
    expect(runs.length).toBeLessThanOrEqual(50);
  });

  test("rejects writes without a token", async ({ request }) => {
    const response = await request.post("/api/runs", { data: { project: PROJECT } });
    expect(response.status()).toBe(401);
  });

  test("unknown routes return JSON 404", async ({ request }) => {
    const response = await request.get("/api/nope");
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ error: "not_found" });
  });
});

test.describe("Results API: write (local only)", () => {
  test.skip(!isLocal, "Writes run only against the local server");

  let auth: Record<string, string>;
  test.beforeAll(() => {
    auth = { Authorization: `Bearer ${localToken()}` };
  });

  async function startRun(request: APIRequestContext) {
    const response = await request.post("/api/runs", {
      headers: auth,
      data: { project: PROJECT, trigger: "manual", targetUrl: "http://localhost:8787", commitSha: "abc1234" },
    });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { id: string }).id;
  }

  test("records a run, derives counts and finishes as failed when a test failed", async ({ request }) => {
    const id = await startRun(request);
    const post = (data: object) => request.post(`/api/runs/${id}/results`, { headers: auth, data });

    expect((await post({ title: "passes", file: "a.spec.ts", status: "passed", durationMs: 10 })).status()).toBe(201);
    expect(
      (
        await post({
          title: "heals",
          file: "a.spec.ts",
          status: "healed",
          durationMs: 20,
          healing: { element: "Sign in button", broken: "role", used: "test id", suggestion: "new role" },
        })
      ).status(),
    ).toBe(201);
    const failed = await post({
      title: "fails",
      file: "b.spec.ts",
      status: "failed",
      durationMs: 30,
      error: { message: "Expected Sign in" },
      screenshot: JPEG,
    });
    expect(failed.status()).toBe(201);
    const failedId = ((await failed.json()) as { id: string }).id;

    const live = await (await request.get(`/api/runs/${id}`)).json();
    expect(live).toMatchObject({ status: "running", counts: { passed: 1, healed: 1, failed: 1, skipped: 0 } });

    const finish = await request.post(`/api/runs/${id}/finish`, { headers: auth });
    expect(await finish.json()).toMatchObject({ status: "failed" });

    const late = await post({ title: "late", file: "a.spec.ts", status: "passed", durationMs: 1 });
    expect(late.status()).toBe(409);

    const shot = await request.get(`/api/results/${failedId}/screenshot`);
    expect(shot.status()).toBe(200);
    expect(shot.headers()["content-type"]).toBe("image/jpeg");
  });

  test("rejects invalid results", async ({ request }) => {
    const id = await startRun(request);
    const post = (data: object) => request.post(`/api/runs/${id}/results`, { headers: auth, data });

    expect((await post({ title: "x", file: "y", status: "healed", durationMs: 1 })).status()).toBe(400);
    expect((await post({ title: "x", file: "y", status: "unknown", durationMs: 1 })).status()).toBe(400);
    expect((await post({ title: "x", file: "y", status: "passed", durationMs: -5 })).status()).toBe(400);
    const notJpeg = Buffer.from("hello").toString("base64");
    expect((await post({ title: "x", file: "y", status: "failed", durationMs: 1, screenshot: notJpeg })).status()).toBe(
      400,
    );
    const oversized = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(210 * 1024)]).toString("base64");
    expect([400, 413]).toContain(
      (await post({ title: "x", file: "y", status: "failed", durationMs: 1, screenshot: oversized })).status(),
    );
  });
});

test.describe("Results API: requirements (local only)", () => {
  test.skip(!isLocal, "Writes run only against the local server");
  // Jira stories come from the stub server (tests/bot/stub-server.mjs): KAN-1 open, KAN-2 done.

  interface Req {
    key: string;
    title: string;
    url: string | null;
    issueState: string | null;
    state: string;
    tests: { title: string; status: string }[];
  }

  test("links tagged tests to Jira stories and keeps each test's latest result", async ({ request }) => {
    const auth = { Authorization: `Bearer ${localToken()}` };
    const stamp = Date.now();
    const orphan = `KAN-${9000 + (stamp % 1000)}`;
    const run = async (filter?: string) => {
      const response = await request.post("/api/runs", {
        headers: auth,
        data: { project: "wealthlite", trigger: "manual", targetUrl: "http://localhost:8787", filter },
      });
      return ((await response.json()) as { id: string }).id;
    };
    const result = (id: string, title: string, status: string, tags?: unknown) =>
      request.post(`/api/runs/${id}/results`, {
        headers: auth,
        data: { title: `${title} ${stamp}`, file: "req.spec.ts", status, durationMs: 1, tags },
      });

    const full = await run();
    expect((await result(full, "signs in", "passed", ["@KAN-1", "@KAN-101", "@smoke"])).status()).toBe(201);
    expect((await result(full, "orphan check", "failed", [`@${orphan}`, "@KAN-102", "@regression"])).status()).toBe(
      201,
    );
    expect((await result(full, "untagged", "passed")).status()).toBe(201);
    expect((await result(full, "bad tag", "passed", ["no-at-sign"])).status()).toBe(400);
    await request.post(`/api/runs/${full}/finish`, { headers: auth });

    const read = async () => {
      const response = await request.get("/api/requirements");
      expect(response.status()).toBe(200);
      return (await response.json()) as { requirements: Req[]; issuesLoaded: boolean };
    };
    let body = await read();
    expect(body.issuesLoaded).toBe(true);
    const signIn = body.requirements.find((r) => r.key === "KAN-1");
    expect(signIn).toMatchObject({ title: "Sign in with email and password", issueState: "open", state: "passing" });
    expect(signIn?.tests.map((t) => t.title)).toContain(`signs in ${stamp}`);
    expect(body.requirements.find((r) => r.key === "KAN-2")).toMatchObject({ issueState: "closed", state: "untested" });
    // The Test issue tag never becomes a row of its own: only the first Jira tag (the story) groups a test.
    expect(body.requirements.find((r) => r.key === "KAN-101")).toBeUndefined();
    expect(body.requirements.find((r) => r.key === orphan)).toMatchObject({
      title: "",
      url: null,
      state: "failing",
    });

    // A filtered rerun of the orphan's test replaces its result, and the run records the filter.
    const rerun = await run(`@${orphan}`);
    await result(rerun, "orphan check", "passed", [`@${orphan}`, "@KAN-102", "@regression"]);
    await request.post(`/api/runs/${rerun}/finish`, { headers: auth });
    expect(((await (await request.get(`/api/runs/${rerun}`)).json()) as { filter: string }).filter).toBe(`@${orphan}`);
    body = await read();
    expect(body.requirements.find((r) => r.key === orphan)?.state).toBe("passing");
  });
});

test.describe("Results API: metrics (local only)", () => {
  test.skip(!isLocal, "Writes run only against the local server");
  // Jira Test issues come from the stub server: 3 total, 2 automated, 1 pending.

  test("reports flaky and healed tests, coverage and a readiness verdict with reasons", async ({ request }) => {
    const auth = { Authorization: `Bearer ${localToken()}` };
    const stamp = Date.now();
    const commitSha = `c0ffee${stamp}`.slice(0, 40);
    const run = async (filter: string) =>
      (
        (await (
          await request.post("/api/runs", {
            headers: auth,
            data: { project: "wealthlite", trigger: "manual", targetUrl: "http://localhost:8787", commitSha, filter },
          })
        ).json()) as { id: string }
      ).id;
    const result = (id: string, title: string, status: string, extra: object = {}) =>
      request.post(`/api/runs/${id}/results`, {
        headers: auth,
        data: { title: `${title} ${stamp}`, file: "metrics.spec.ts", status, durationMs: 1000, ...extra },
      });
    const finish = (id: string) => request.post(`/api/runs/${id}/finish`, { headers: auth });

    // Same commit: the test fails, then passes. That is flaky, not a code change.
    const red = await run("@smoke");
    await result(red, "flips", "failed", { error: { message: "boom" } });
    await finish(red);
    const green = await run("@smoke");
    await result(green, "flips", "passed");
    await result(green, "heals", "healed", {
      healing: {
        element: "Sign in button",
        broken: "role=button[name=Sign in]",
        used: "testid",
        suggestion: "getByRole('button', { name: 'Log in' })",
      },
    });
    await finish(green);

    const response = await request.get("/api/metrics");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      passRate: number | null;
      trend: { runId: string; suite: string; passRate: number }[];
      flaky: { title: string; failures: number; passes: number }[];
      healed: { title: string; suggestion: string }[];
      coverage: { total: number; automated: number; smoke: number; regression: number; pending: number } | null;
      timeToGreenMs: number | null;
      readiness: { verdict: string; reasons: { level: string; text: string }[] };
    };

    expect(body.trend.find((p) => p.runId === red)).toMatchObject({ suite: "smoke", passRate: 0 });
    expect(body.trend.find((p) => p.runId === green)).toMatchObject({ suite: "smoke", passRate: 1 });
    expect(body.flaky.find((f) => f.title === `flips ${stamp}`)).toMatchObject({ failures: 1, passes: 1 });
    expect(body.healed.find((h) => h.title === `heals ${stamp}`)?.suggestion).toBe(
      "getByRole('button', { name: 'Log in' })",
    );
    expect(body.coverage).toEqual({ total: 3, automated: 2, smoke: 2, regression: 1, pending: 1 });
    expect(body.timeToGreenMs).not.toBeNull();
    expect(["go", "caution", "no-go"]).toContain(body.readiness.verdict);
    expect(body.readiness.verdict).not.toBe("go"); // flaky and healed tests always mean caution at least
    expect(body.readiness.reasons.map((r) => r.text).join(" ")).toMatch(/flaky test\(s\)/);
  });
});

test.describe("Results API: AI evals (local only)", () => {
  test.skip(!isLocal, "Writes run only against the local server");

  test("only the AI evals token can write, input is validated, and the summary covers all three kinds", async ({
    request,
  }) => {
    const post = (data: object, token = localToken("AI_EVALS_TOKEN")) =>
      request.post("/api/ai-evals", { headers: { Authorization: `Bearer ${token}` }, data });

    // The results token cannot write evals, and the evals token is required.
    expect((await post({ kind: "live", score: 50 }, localToken())).status()).toBe(401);
    expect((await post({ kind: "nope" })).status()).toBe(400);
    expect((await post({ kind: "live", score: 120 })).status()).toBe(400);
    expect((await post({ kind: "live", storyKey: "DROP TABLE" })).status()).toBe(400);

    const stamp = Date.now();
    const mean = 50 + (stamp % 40) / 10; // unique, so this run's row is recognisable
    expect(
      (
        await post({
          kind: "golden",
          model: "qwen3.5:2b",
          promptVersion: "test",
          score: mean,
          details: { perStory: { "G-01": 40, "G-02": 100 } },
          runUrl: "https://github.com/aswinrajmk/wealthlite/actions/runs/1",
        })
      ).status(),
    ).toBe(201);
    expect((await post({ kind: "live", storyKey: "KAN-6", score: 90, summary: `Score 90% ${stamp}` })).status()).toBe(
      201,
    );
    expect((await post({ kind: "automation", engine: "local", outcome: "draft", storyKey: "KAN-6" })).status()).toBe(
      201,
    );

    const body = (await (await request.get("/api/ai-evals")).json()) as {
      golden: { latest: { mean: number; perStory: Record<string, number> } | null };
      live: { count: number; recent: { summary: string }[] };
      automation: { engine: string; runs: number; draft: number }[];
    };
    expect(body.golden.latest).toMatchObject({ mean: Math.round(mean * 10) / 10, perStory: { "G-01": 40 } });
    expect(body.live.recent.map((d) => d.summary)).toContain(`Score 90% ${stamp}`);
    expect(body.automation.find((e) => e.engine === "local")?.draft).toBeGreaterThan(0);
    expect(body.automation.map((e) => e.engine)).toEqual(["claude", "local"]);
  });
});
