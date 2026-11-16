import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

interface PageProblems {
  consoleErrors: string[];
  failedRequests: string[];
}

// Every test gets a page that records console errors and failed requests,
// and fails at teardown if anything was recorded.
export const test = base.extend<{ problems: PageProblems; axe: () => Promise<void> }>({
  problems: async ({ page }, use) => {
    const problems: PageProblems = { consoleErrors: [], failedRequests: [] };
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const source = msg.location().url;
      const isApi404 =
        msg.text().includes("status of 404") && source !== "" && new URL(source).pathname.startsWith("/api/");
      if (!isApi404) problems.consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => problems.consoleErrors.push(error.message));
    page.on("requestfailed", (request) => {
      // Navigating away cancels in-flight requests (fonts, for example). That is not a site fault.
      const reason = request.failure()?.errorText ?? "";
      if (reason.includes("ERR_ABORTED")) return;
      problems.failedRequests.push(`${request.method()} ${request.url()} (${reason})`);
    });
    page.on("response", (response) => {
      // A 404 from the Results API ("no runs yet", "run not found") is an answer the UI handles, not a fault.
      const expectedApi404 = response.status() === 404 && new URL(response.url()).pathname.startsWith("/api/");
      if (response.status() >= 400 && !expectedApi404) {
        problems.failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    await use(problems);
    expect.soft(problems.consoleErrors, "console errors").toEqual([]);
    expect.soft(problems.failedRequests, "failed requests").toEqual([]);
  },
  axe: async ({ page }, use) => {
    await use(async () => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`);
      expect(serious, "serious or critical accessibility violations").toEqual([]);
    });
  },
});

export { expect };

export async function sectionHeadings(page: Page) {
  return page.getByRole("heading", { level: 2 }).allTextContents();
}
