// Renders the app icon to the PNG sizes in web/public, and the README banner (output is committed; rerun only to change the design)
// Source: docs/brand/app-icon.svg. Run: node scripts/make-icons.mjs (uses the Playwright Chromium installed for tests)
/* global console */
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "web", "public");

const source = await readFile(join(root, "docs", "brand", "app-icon.svg"), "utf8");
const tile = source.match(/<rect [^>]*fill="(#[0-9A-Fa-f]{6})"/)?.[1];
const glyph = source.match(/<rect [^>]*\/>(.*)<\/svg>/s)?.[1];
if (!tile || !glyph) throw new Error("docs/brand/app-icon.svg: expected a <rect> tile followed by the glyph");

// Rounded tile, as drawn in the source: favicon and the 192/512 "any" icons
const ROUNDED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${tile}"/>${glyph}
</svg>`;

// Full-bleed square; the phone applies its own mask. Android's maskable safe zone is a circle of
// radius 40, so the glyph shrinks there; iOS only rounds the corners, so it keeps full size
const fullBleed = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${tile}"/>
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${glyph}</g>
</svg>`;

const TARGETS = [
  { file: "icon-192.png", svg: ROUNDED, size: 192, transparent: true },
  { file: "icon-512.png", svg: ROUNDED, size: 512, transparent: true },
  { file: "icon-maskable-512.png", svg: fullBleed(0.85), size: 512, transparent: false },
  { file: "apple-touch-icon.png", svg: fullBleed(1), size: 180, transparent: false },
];

await writeFile(join(out, "icon.svg"), `${ROUNDED}\n`);

const browser = await chromium.launch();
for (const { file, svg, size, transparent } of TARGETS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: join(out, file), omitBackground: transparent });
  await page.close();
  console.log(`wrote ${file}`);
}
// README banner: glyph + wordmark (Space Grotesk, embedded so the render doesn't depend on installed fonts)
const font = (await readFile(join(root, "web", "src", "fonts", "space-grotesk-latin-wght-normal.woff2"))).toString("base64");
const banner = await browser.newPage({ viewport: { width: 880, height: 220 }, deviceScaleFactor: 2 });
await banner.setContent(`<style>
  @font-face { font-family: "Space Grotesk"; font-weight: 300 700; src: url(data:font/woff2;base64,${font}) format("woff2"); }
  body { margin: 0; }
  .card { width: 880px; height: 220px; box-sizing: border-box; display: flex; align-items: center; justify-content: center;
    gap: 26px; border-radius: 28px; color: #fff; font: 400 60px "Space Grotesk";
    background: linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px) 0 0 / 42px 42px,
      linear-gradient(90deg, rgb(255 255 255 / 3%) 1px, transparent 1px) 0 0 / 42px 42px, #071527; }
  b { color: #20d8b5; font-weight: 700; }
</style><div class="card">${glyph.replace("<g ", '<svg viewBox="16 16 68 68" width="104" height="104"><g ').concat("</svg>")}<span><b>Lingua</b> Camera</span></div>`);
await banner.evaluate(() => document.fonts.ready);
await banner.screenshot({ path: join(root, "docs", "brand", "readme-banner.png"), omitBackground: true });
console.log("wrote docs/brand/readme-banner.png");

await browser.close();
