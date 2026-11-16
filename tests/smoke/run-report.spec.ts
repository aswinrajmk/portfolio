import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

// Seeds a run through the API, so it only runs against the local server and local D1.
test.skip(!!process.env.BASE_URL, "Seeds data, so runs only locally");

const token = () =>
  readFileSync(".dev.vars", "utf8")
    .match(/^RESULTS_API_TOKEN=(.+)$/m)?.[1]
    ?.trim() ?? "";

test("shows healed and failed tests with details, and is accessible", async ({ page, request, problems, axe }) => {
  void problems;
  const headers = { Authorization: `Bearer ${token()}` };
  const start = await request.post("/api/runs", {
    headers,
    data: { project: "run-report-spec", trigger: "deploy", targetUrl: "http://localhost:8787", commitSha: "abc1234" },
  });
  const { id } = (await start.json()) as { id: string };
  const add = (data: object) => request.post(`/api/runs/${id}/results`, { headers, data });
  await add({
    title: "signs in",
    file: "auth/login.spec.ts",
    status: "healed",
    durationMs: 900,
    healing: {
      element: "Sign in button",
      broken: "getByRole('button', { name: 'Sign in' })",
      used: "getByTestId('login-submit')",
      suggestion: "getByRole('button', { name: 'Log in' })",
    },
  });
  await add({
    title: "button copy",
    file: "content/copy.spec.ts",
    status: "failed",
    durationMs: 300,
    error: { message: "Expected Sign in" },
  });
  await add({ title: "holdings", file: "portfolio.spec.ts", status: "passed", durationMs: 200 });

  await page.goto(`/dashboard/run/?id=${id}`);
  await expect(page.locator("[data-run-status]").first()).toHaveText("Running");
  await expect(page.getByText("Suggested fix:")).toBeVisible();
  await expect(page.getByText("Expected Sign in")).toBeVisible();
  await expect(page.locator("[data-test-status]")).toHaveText(["Healed", "Failed", "Passed"]);

  // Finishing the run is picked up by polling without a reload.
  await request.post(`/api/runs/${id}/finish`, { headers });
  await expect(page.locator("[data-run-status]").first()).toHaveText("Failed", { timeout: 5_000 });

  await axe();
});
