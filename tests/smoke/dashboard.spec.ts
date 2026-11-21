import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const TABS = {
  overview: ["Release readiness", "Latest pipeline run"],
  quality: ["Quality metrics and release readiness", "Requirements coverage"],
  "ai-workflow": ["Jira to automated tests: AI agents with approvals", "Pipeline architecture"],
  "how-i-work": ["Skills and evidence", "Test strategy", "Decisions", "AI agents and leadership"],
} as const;
type TabId = keyof typeof TABS;

async function open(page: Page, hash: TabId | string = "overview") {
  // A hash-only change on the same page is a same-document navigation, which has no HTTP response.
  const response = await page.goto(`/dashboard/#${hash}`);
  if (response) expect(response.status()).toBe(200);
}

test.describe("QA dashboard tabs", () => {
  test.beforeEach(async ({ problems }) => {
    void problems;
  });

  test("has the right title, four tabs, and the right sections in each", async ({ page }) => {
    await open(page);
    await expect(page).toHaveTitle("QA dashboard · Aswin Raj");
    await expect(page.getByRole("tab")).toHaveText(["Overview", "Quality", "AI workflow", "How I work"]);
    for (const [tab, headings] of Object.entries(TABS)) {
      await open(page, tab);
      await expect(page.getByRole("tab", { selected: true })).toHaveAttribute("href", `#${tab}`);
      await expect(page.getByRole("tabpanel").getByRole("heading", { level: 2 })).toHaveText([...headings]);
    }
  });

  test("opens Overview by default, with the verdict and KPIs in the first screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard/");
    await expect(page.getByRole("tab", { selected: true })).toHaveText("Overview");
    const verdict = page.locator("#readiness [data-verdict]");
    await expect(verdict).toHaveText(/Release readiness: (GO|CAUTION|NO-GO)/);
    await expect(verdict).toBeInViewport();
    await expect(page.locator("#readiness .kpi").first()).toBeInViewport();
    await expect(page.getByRole("link", { name: /See all quality detail/ })).toHaveAttribute("href", "#quality");
  });

  test("older links to a section open its tab and scroll to it", async ({ page }) => {
    for (const [hash, tab] of [
      ["metrics", "Quality"],
      ["requirements", "Quality"],
      ["jira-agent", "AI workflow"],
      ["evidence", "How I work"],
    ] as const) {
      await open(page, hash);
      await expect(page.getByRole("tab", { selected: true })).toHaveText(tab);
      await expect(page.locator(`#${hash}`)).toBeInViewport();
    }
  });

  test("tabs work with the keyboard and with back and forward", async ({ page }) => {
    await open(page);
    await page.getByRole("tab", { name: "Overview" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { selected: true })).toHaveText("Quality");
    await expect(page.getByRole("tab", { name: "Quality" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { selected: true })).toHaveText("How I work");
    await page.goBack();
    await expect(page.getByRole("tab", { selected: true })).toHaveText("Quality");
  });

  test("labels sample data, or links real runs to their report", async ({ page }) => {
    await open(page);
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

  test("shows quality metrics with a release verdict, KPIs and an accessible trend", async ({ page }) => {
    await open(page, "quality");
    const section = page.locator("#metrics");
    await expect(section.locator("[data-verdict]")).toHaveText(/Release readiness: (GO|CAUTION|NO-GO)/);
    for (const kpi of ["Pass rate", "Flaky tests", "Healed locators to fix", "Automation coverage"]) {
      await expect(section.locator(".kpi dt", { hasText: kpi })).toBeVisible();
    }
    const trend = section.getByRole("group", { name: /^Pass rate per run\./ });
    if (await trend.count()) await expect(trend).toBeVisible();
    else await expect(section.getByText("The pass-rate trend appears after a few more suite runs.")).toBeVisible();
  });

  test("shows requirement coverage with a state for every requirement, or says why not", async ({ page }) => {
    await open(page, "quality");
    const section = page.locator("#requirements");
    await expect(section.locator("table, .note").first()).toBeVisible();
    for (const row of await section.locator("tbody tr").all()) {
      await expect(row.locator("[data-requirement-state]")).toHaveText(/^(Passing|Failing|No tests yet)$/);
    }
  });

  test("explains the Jira to automated tests flow with its tools and a real example", async ({ page }) => {
    await open(page, "ai-workflow");
    const section = page.locator("#jira-agent");
    await expect(section.locator("[data-status=live]").first()).toBeVisible();
    await expect(
      section.getByRole("img", {
        name: "Flow from a new Jira story to approved Jira Test issues and automated Playwright tests",
      }),
    ).toBeVisible();
    // Steps and tools start folded, to keep the tab short.
    await expect(section.locator(".agent-steps")).toBeHidden();
    for (const summary of await section.locator(".agent__more > summary").all()) await summary.click();
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
    await expect(example.getByRole("link", { name: "qa-tests PR #8" })).toHaveAttribute(
      "href",
      "https://github.com/aswinrajmk/qa-tests/pull/8",
    );
    await expect(section.getByRole("link", { name: "Workflow and build script in wealthlite" })).toHaveAttribute(
      "href",
      "https://github.com/aswinrajmk/wealthlite/tree/main/automation/n8n",
    );
    await expect(
      page.getByRole("img", { name: "Pipeline from a requirement to the live report and Telegram" }),
    ).toBeVisible();
  });

  test("shows a status badge and an evidence link for every live skill", async ({ page }) => {
    await open(page, "how-i-work");
    const rows = page.locator("#evidence tbody tr");
    await expect(rows).toHaveCount(9);
    for (const row of await rows.all()) {
      await expect(row.locator("[data-status]")).toHaveText(/^(Live|In progress|Planned)$/);
    }
    const liveRows = page.locator("#evidence tbody tr", { has: page.locator("[data-status=live]") });
    for (const row of await liveRows.all()) await expect(row.getByRole("link")).toHaveCount(1);
    await expect(page.locator("#strategy [data-tag=draft]")).toBeVisible();
    await expect(page.locator("#decisions [data-tag=draft]")).toHaveCount(4);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    for (const tab of Object.keys(TABS) as TabId[]) {
      test(`${tab} tab has no serious accessibility violations (${colorScheme})`, async ({ page, axe }) => {
        await page.emulateMedia({ colorScheme });
        await open(page, tab);
        await expect(page.getByRole("tabpanel").getByRole("heading", { level: 2 }).first()).toBeVisible();
        await axe();
      });
    }
  }
});

test.describe("Run report", () => {
  test("explains when a run does not exist", async ({ page, problems }) => {
    void problems;
    await page.goto("/dashboard/run/?id=00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Run not found");
  });
});
