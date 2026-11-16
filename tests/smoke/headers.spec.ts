import { expect, test } from "@playwright/test";

// EXPECT_NOINDEX=1 when testing a preview deployment; unset for production and local runs.
const expectNoindex = process.env.EXPECT_NOINDEX === "1";

test.describe("Response headers and routing", () => {
  for (const path of ["/", "/dashboard/"]) {
    test(`${path} ${expectNoindex ? "sends" : "does not send"} X-Robots-Tag: noindex`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const robots = response.headers()["x-robots-tag"] ?? "";
      if (expectNoindex) expect(robots).toContain("noindex");
      else expect(robots).not.toContain("noindex");
    });
  }

  test("sends security headers", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("returns the 404 page for unknown paths", async ({ request }) => {
    const response = await request.get("/this-page-does-not-exist");
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("Page not found");
  });
});
