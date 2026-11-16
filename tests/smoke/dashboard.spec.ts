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
      "Skills and evidence",
      "Pipeline architecture",
      "Test strategy",
      "Decisions",
      "AI agents and leadership",
    ]);
  });

  test("labels the run as sample data while no real pipeline feeds it", async ({ page }) => {
    const run = page.locator("#latest-run");
    await expect(run.locator("[data-tag=sample]")).toHaveText("Sample data");
    await expect(run.locator(".run")).toHaveAttribute("data-source", "sample");
  });

  test("shows a status badge for every skill", async ({ page }) => {
    const rows = page.locator("#evidence tbody tr");
    await expect(rows).toHaveCount(7);
    for (const row of await rows.all()) {
      await expect(row.locator("[data-status]")).toHaveText(/^(Live|In progress|Planned)$/);
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
    await expect(page.locator("#decisions [data-tag=draft]")).toHaveCount(3);
  });

  test("renders the pipeline diagram with an accessible name", async ({ page }) => {
    await expect(page.getByRole("img", { name: "Pipeline from pull request to dashboard and Telegram" })).toBeVisible();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no serious accessibility violations (${colorScheme})`, async ({ page, axe }) => {
      await page.emulateMedia({ colorScheme });
      await axe();
    });
  }
});
