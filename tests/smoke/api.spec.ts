import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Read-only checks run everywhere. Write checks run only against the local server (BASE_URL unset),
// so this suite never writes test data to production or preview databases.
const isLocal = !process.env.BASE_URL;

function localToken(): string {
  const line = readFileSync(".dev.vars", "utf8")
    .split("\n")
    .find((l) => l.startsWith("RESULTS_API_TOKEN="));
  if (!line) throw new Error("RESULTS_API_TOKEN missing from .dev.vars");
  return line.slice("RESULTS_API_TOKEN=".length).trim();
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
