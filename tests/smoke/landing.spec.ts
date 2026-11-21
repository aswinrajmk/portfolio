import { expect, sectionHeadings, test } from "./fixtures";

test.describe("Profile page", () => {
  test.beforeEach(async ({ page, problems }) => {
    void problems;
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("shows name, title and summary", async ({ page }) => {
    await expect(page).toHaveTitle("Aswin Raj · Lead Engineer, QA");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aswin Raj");
    await expect(page.getByText("over eight years", { exact: false }).first()).toBeVisible();
  });

  test("has every section in order", async ({ page }) => {
    expect(await sectionHeadings(page)).toEqual(["Experience", "Skills", "Credentials", "Contact"]);
  });

  test("toolbox shows the AI tools and what this portfolio is built with", async ({ page }) => {
    const toolbox = page.locator("#skills .toolbox");
    await expect(toolbox.locator("dt", { hasText: "AI and agents" })).toBeVisible();
    await expect(toolbox.locator("dt", { hasText: "Built in this portfolio" })).toBeVisible();
    for (const tool of ["Claude Code", "n8n", "Ollama (Qwen)", "GitHub Actions", "BrowserStack", "ReportPortal"]) {
      await expect(toolbox).toContainText(tool);
    }
  });

  test("lists all four roles", async ({ page }) => {
    const experience = page.locator("#experience");
    for (const company of ["QBurst Technologies", "Infosys", "Vofox Solutions", "DLI-IT Group"]) {
      await expect(experience.getByText(company, { exact: true })).toBeVisible();
    }
  });

  test("contact links point to the right places", async ({ page }) => {
    const contact = page.locator("#contact");
    await expect(contact.getByRole("link", { name: "aswin.nrk@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:aswin.nrk@gmail.com",
    );
    await expect(contact.getByRole("link", { name: "linkedin.com/in/aswinrajmk" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/aswinrajmk",
    );
    await expect(contact.getByRole("link", { name: "github.com/aswinrajmk" })).toHaveAttribute(
      "href",
      "https://github.com/aswinrajmk",
    );
    await expect(contact.getByRole("link")).toHaveCount(3);
  });

  test("never shows a phone number", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText(/\+?\d[\d\s-]{8,}\d/);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  });

  test("links to the QA dashboard", async ({ page }) => {
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "QA dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How I work, in public");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no serious accessibility violations (${colorScheme})`, async ({ page, axe }) => {
      await page.emulateMedia({ colorScheme });
      await axe();
    });
  }
});
