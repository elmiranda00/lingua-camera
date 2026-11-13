// Browser smoke test
//
// The built app, served by the Worker, loads on one origin with no CSP violations or console errors
import { expect, test } from "@playwright/test";

type WithCsp = { __csp: string[] };

test("app loads on one origin with no CSP violations or errors", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is not set");
  const ownOrigin = new URL(baseURL).origin;

  const violations: string[] = [];
  const errors: string[] = [];
  const foreignRequests: string[] = [];

  await page.addInitScript(() => {
    (window as unknown as WithCsp).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as WithCsp).__csp.push(`${e.violatedDirective}: ${e.blockedURI}`),
    );
  });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    const url = new URL(r.url());
    const isWeb = url.protocol === "http:" || url.protocol === "https:";
    if (isWeb && url.origin !== ownOrigin) foreignRequests.push(r.url());
  });
  const collectViolations = async () =>
    violations.push(...(await page.evaluate(() => (window as unknown as WithCsp).__csp)));

  await test.step("home page shows the API version from the loader", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Lingua Camera" })).toBeVisible();
    await expect(page.getByText("API smoke")).toBeVisible();
    await collectViolations();
  });

  await test.step("unknown paths show the not-found page", async () => {
    await page.goto("/no/such/page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await collectViolations();
  });

  expect(violations, "CSP violations").toEqual([]);
  expect(foreignRequests, "requests to other origins").toEqual([]);
  expect(errors, "console errors").toEqual([]);
});
