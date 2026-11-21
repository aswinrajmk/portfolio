import { expect, sectionHeadings, test } from "./fixtures";

test.describe("QA dashboard", () => {
  test.beforeEach(async ({ page, problems }) => {
    void problems;
    const response = await page.goto("/dashboard/");
    expect(response?.status()).toBe(200);
  });

  test("has the right title and every section in order", async ({ page }) => {
    await expect(page).toHaveTitle("QA dashboard · Aswin Raj");
    expect(await sectionHeadings(page)).toEqual([
      "Latest pipeline run",
      "Quality metrics and release readiness",
      "Requirements coverage",
      "Jira to automated tests: AI agents with approvals",
      "Skills and evidence",
      "Pipeline architecture",
      "Test strategy",
      "Decisions",
      "AI agents and leadership",
    ]);
  });

  test("labels sample data, or links real runs to their report", async ({ page }) => {
    const run = page.locator("#latest-run .run");
    await expect(run).toBeVisible();
    if ((await run.getAttribute("data-source")) === "sample") {
      await expect(page.locator("#latest-run [data-tag=sample]")).toHaveText("Sample data");
      await expect(run.getByRole("link", { name: /full run report/ })).toHaveCount(0);
    } else {
      await expect(page.locator("#latest-run [data-tag=sample]")).toHaveCount(0);
      await expect(run.getByRole("link", { name: /full run report/ })).toHaveAttribute(
        "href",
        /\/dashboard\/run\/\?id=/,
      );
    }
    await expect(run.locator("[data-run-status]")).toHaveText(/^(Running|Passed|Failed|Incomplete)$/);
  });

  test("shows a status badge for every skill", async ({ page }) => {
    const rows = page.locator("#evidence tbody tr");
    await expect(rows).toHaveCount(9);
    for (const row of await rows.all()) {
      await expect(row.locator("[data-status]")).toHaveText(/^(Live|In progress|Planned)$/);
    }
  });

  test("shows requirement coverage with a state for every requirement, or says why not", async ({ page }) => {
    const section = page.locator("#requirements");
    await expect(section.locator("table, .note").first()).toBeVisible();
    const rows = section.locator("tbody tr");
    for (const row of await rows.all()) {
      await expect(row.locator("[data-requirement-state]")).toHaveText(/^(Passing|Failing|No tests yet)$/);
    }
  });

  test("never marks a skill live without an evidence link", async ({ page }) => {
    const liveRows = page.locator("#evidence tbody tr", { has: page.locator("[data-status=live]") });
    for (const row of await liveRows.all()) {
      await expect(row.getByRole("link")).toHaveCount(1);
    }
  });

  test("marks strategy notes and decisions as drafts", async ({ page }) => {
    await expect(page.locator("#strategy [data-tag=draft]")).toBeVisible();
    await expect(page.locator("#decisions [data-tag=draft]")).toHaveCount(4);
  });

  test("explains the Jira to automated tests flow with its tools and a real example", async ({ page }) => {
    const section = page.locator("#jira-agent");
    await expect(section.locator("[data-status=live]").first()).toBeVisible();
    await expect(
      section.getByRole("img", {
        name: "Flow from a new Jira story to approved Jira Test issues and automated Playwright tests",
      }),
    ).toBeVisible();
    await expect(section.locator(".agent-steps > li")).toHaveCount(9);
    for (const tool of [
      "n8n (self-hosted)",
      "Ollama + Qwen 3.5",
      "Jira Cloud REST API",
      "Telegram Bot API",
      "Claude Code in GitHub Actions",
    ]) {
      await expect(section.getByText(tool, { exact: true })).toBeVisible();
    }
    const example = section.getByRole("article", { name: "Example from a real run" });
    await expect(example).toBeVisible();
    await expect(example.getByRole("link", { name: "qa-tests PR #8" })).toHaveAttribute(
      "href",
      "https://github.com/aswinrajmk/qa-tests/pull/8",
    );
    await expect(section.getByRole("link", { name: "Workflow and build script in wealthlite" })).toHaveAttribute(
      "href",
      "https://github.com/aswinrajmk/wealthlite/tree/main/automation/n8n",
    );
  });

  test("shows quality metrics with a release verdict, KPIs and an accessible trend", async ({ page }) => {
    const section = page.locator("#metrics");
    await expect(section.getByRole("heading", { name: "Quality metrics and release readiness" })).toBeVisible();
    await expect(section.locator("[data-verdict]")).toHaveText(/Release readiness: (GO|CAUTION|NO-GO)/);
    for (const kpi of ["Pass rate", "Flaky tests", "Healed locators to fix", "Automation coverage"]) {
      await expect(section.locator(".kpi dt", { hasText: kpi })).toBeVisible();
    }
    const trend = section.getByRole("group", { name: /^Pass rate per run\./ });
    if (await trend.count()) await expect(trend).toBeVisible();
    else await expect(section.getByText("The pass-rate trend appears after a few more suite runs.")).toBeVisible();
  });

  test("renders the pipeline diagram with an accessible name", async ({ page }) => {
    await expect(
      page.getByRole("img", { name: "Pipeline from a requirement to the live report and Telegram" }),
    ).toBeVisible();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no serious accessibility violations (${colorScheme})`, async ({ page, axe }) => {
      await page.emulateMedia({ colorScheme });
      await axe();
    });
  }
});

test.describe("Run report", () => {
  test("explains when a run does not exist", async ({ page, problems }) => {
    void problems;
    await page.goto("/dashboard/run/?id=00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Run not found");
  });
});
