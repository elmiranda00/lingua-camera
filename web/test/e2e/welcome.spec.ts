// Welcome screen: invite link → greeting with the name → "Open the Camera" starts the camera at once
//
// The smoke Worker has no database, so /api/me is answered by the test. The camera is Chromium's fake device
import { expect, test } from "@playwright/test";

type WithCsp = { __csp: string[] };

const TOKEN = "A".repeat(43); // the shape `npm run user:add` issues

test.use({
  permissions: ["camera"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

test("an invite link shows the welcome screen, and Open the Camera goes straight to the live camera", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL is not set");
  const ownOrigin = new URL(baseURL).origin;
  const errors: string[] = [];
  const foreignRequests: string[] = [];
  const fontRequests: string[] = [];

  await page.addInitScript(() => {
    (window as unknown as WithCsp).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as WithCsp).__csp.push(`${e.violatedDirective}: ${e.blockedURI}`),
    );
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("onnxruntime")) errors.push(m.text());
  });
  page.on("request", (r) => {
    const url = new URL(r.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== ownOrigin) foreignRequests.push(r.url());
    if (r.resourceType() === "font") fontRequests.push(url.pathname);
  });
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-request-id": "e2e" },
      body: JSON.stringify({ id: "u1", name: "Alex" }),
    }),
  );

  await test.step("the link signs in and greets the user by name", async () => {
    await page.goto(`/join#${TOKEN}`);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, Alex" })).toBeVisible();
    await expect(page.getByText("You are signed in")).toBeVisible();
    await expect(page).toHaveURL(/\/join$/); // the token left the address bar
  });

  await test.step("the greeting rotates", async () => {
    await expect(page.getByText("Bienvenue", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  await test.step("the brand fonts load from our own origin", async () => {
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() =>
      ["DM Sans", "DM Serif Display", "Space Grotesk"].filter((f) => document.fonts.check(`16px "${f}"`)),
    );
    expect(loaded).toEqual(["DM Sans", "DM Serif Display", "Space Grotesk"]);
    expect(fontRequests.every((p) => p.startsWith("/assets/") && p.endsWith(".woff2"))).toBe(true);
  });

  await test.step("Open the Camera starts the live camera without the start box", async () => {
    await page.getByRole("button", { name: "Open the Camera" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("Camera view")).toBeVisible();
    await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Start camera" })).toHaveCount(0);
  });

  await test.step("a reload doesn't start the camera on its own", async () => {
    await page.reload();
    await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
  });

  const violations = await page.evaluate(() => (window as unknown as WithCsp).__csp);
  expect(violations, "CSP violations").toEqual([]);
  expect(foreignRequests, "requests to other origins").toEqual([]);
  expect(errors, "console errors").toEqual([]);
});
