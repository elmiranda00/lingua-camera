// Browser smoke test
//
// The built app, served by the Worker, on one origin with no CSP violations or console errors:
// camera page, a photo read by the on-device OCR, word boxes, cached OCR files, and the other pages
import { expect, test } from "@playwright/test";

type WithCsp = { __csp: string[] };

test("app loads on one origin with no CSP violations or errors", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is not set");
  test.setTimeout(180_000); // first run downloads and loads ~25 MB of OCR files
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
    // ONNX Runtime prints harmless warnings about unused model weights through console.error
    if (m.type() === "error" && !m.text().includes("onnxruntime")) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    const url = new URL(r.url());
    const isWeb = url.protocol === "http:" || url.protocol === "https:";
    if (isWeb && url.origin !== ownOrigin) foreignRequests.push(r.url());
  });
  const collectViolations = async () =>
    violations.push(...(await page.evaluate(() => (window as unknown as WithCsp).__csp)));

  await test.step("camera page loads with the camera off, until the icon is tapped", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Lingua Camera" })).toBeAttached();
    await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
    // No camera in the test browser: starting it falls back to the photo buttons
    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(page.getByText("The live camera isn't available here")).toBeVisible();
    await expect(page.getByRole("button", { name: /Language: French/ })).toBeVisible();
    await collectViolations();
  });

  await test.step("a photo is read on the device and every word gets a box", async () => {
    // Draw a French sentence, then add it like a gallery photo
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 300;
      const g = canvas.getContext("2d")!;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, 900, 300);
      g.fillStyle = "#000";
      g.font = "bold 56px Arial, Helvetica, sans-serif";
      g.fillText("Le petit chat dort.", 40, 120);
      g.fillText("Il fait beau aujourd'hui.", 40, 220);
      return canvas.toDataURL("image/png").split(",")[1]!;
    });
    await page
      .locator("label", { hasText: "Choose from gallery" })
      .locator("input")
      .setInputFiles({ name: "page.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
    const boxes = page.locator("button.word");
    await expect(boxes.first()).toBeVisible({ timeout: 150_000 });
    expect(await boxes.count()).toBeGreaterThanOrEqual(5);
    await expect(page.getByText(/read in \d+\.\d s/)).toBeVisible();
    await collectViolations();
  });

  await test.step("tapping a word opens the translation sheet, and tapping another replaces it", async () => {
    // The smoke Worker has no AI or database, so the lookup is answered here
    const seen: { ocrMs: string | undefined; word: string; sentence: string }[] = [];
    await page.route("**/api/lookup", async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as { word: string; sentence: string };
      seen.push({ ocrMs: request.headers()["x-ocr-ms"], word: body.word, sentence: body.sentence });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          surface: body.word,
          headword: body.word,
          pos: "noun",
          gender: null,
          pinyin: null,
          meaningInContext: `meaning of ${body.word}`,
          otherMeanings: ["other sense"],
          note: null,
          cached: false,
          requestId: "e2e",
        }),
      });
    });
    const boxes = page.locator("button.word");
    const sheet = page.getByRole("region", { name: "Translation" });

    await boxes.nth(0).click();
    await expect(sheet).toContainText("meaning of");
    await expect(sheet).toContainText("Also: other sense");
    expect(seen[0]?.ocrMs).toMatch(/^\d+$/);
    expect(seen[0]?.sentence.length).toBeGreaterThan(0);

    await boxes.nth(1).click();
    await expect(sheet).toContainText(`meaning of ${seen[1]?.word}`);
    expect(seen).toHaveLength(2);
    expect(seen[1]?.ocrMs).toBeUndefined(); // sent once, with the first request only

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await collectViolations();
  });

  await test.step("tapping a box selects it, and Retake goes back", async () => {
    const first = page.locator("button.word").first();
    const label = (await first.getAttribute("aria-label")) ?? "";
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("status").filter({ hasText: "read in" })).toContainText(label.split(",")[0]!);
    await page.getByRole("button", { name: "Retake" }).click();
    await expect(page.getByText("The live camera isn't available here")).toBeVisible();
  });

  await test.step("the app manifest and icons are served", async () => {
    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    for (const icon of (await manifest.json()).icons as { src: string }[]) {
      expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);
    }
  });

  await test.step("the service worker has cached the OCR files", async () => {
    const cached = await page.evaluate(async () => {
      const cache = await caches.open("lc-models-v1");
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });
    expect(cached).toEqual(
      expect.arrayContaining([
        "/ort/ort-wasm-simd-threaded.wasm",
        "/models/PP-OCRv5_mobile_det.tar",
        "/models/latin_PP-OCRv5_mobile_rec.tar",
      ]),
    );
  });

  await test.step("the about page shows the API version from the loader", async () => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "Lingua Camera" })).toBeVisible();
    await expect(page.getByText("API smoke")).toBeVisible();
    await collectViolations();
  });

  await test.step("the sign-in page asks for the invite link, and flags a partial one", async () => {
    // The smoke Worker has no database, so only the cases that never call the API run here
    await page.goto("/join");
    await expect(page.getByText("Open the invite link you were sent.")).toBeVisible();
    await page.goto("/join#abc");
    await expect(page.getByText("This link looks incomplete.")).toBeVisible();
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

test("switching to Chinese loads pinyin-pro from our own origin under the CSP", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is not set");
  const ownOrigin = new URL(baseURL).origin;
  const violations: string[] = [];
  const foreignRequests: string[] = [];

  await page.addInitScript(() => {
    (window as unknown as WithCsp).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as WithCsp).__csp.push(`${e.violatedDirective}: ${e.blockedURI}`),
    );
  });
  page.on("request", (r) => {
    const url = new URL(r.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== ownOrigin) foreignRequests.push(r.url());
  });

  await page.goto("/");
  // pinyin-pro is the only chunk that is fetched on demand
  const chunk = page.waitForResponse((res) => /\/assets\/esm-.*\.js$/.test(res.url()));
  await page.getByRole("button", { name: /Language: French/ }).click();
  expect((await chunk).ok()).toBe(true);
  await expect(page.getByRole("button", { name: /Language: Chinese/ })).toBeVisible();

  violations.push(...(await page.evaluate(() => (window as unknown as WithCsp).__csp)));
  expect(violations, "CSP violations").toEqual([]);
  expect(foreignRequests, "requests to other origins").toEqual([]);
});
