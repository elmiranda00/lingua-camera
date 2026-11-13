// Renders the app icon to the PNG sizes in web/public (output is committed; rerun only to change the design)
// Run: node scripts/make-icons.mjs (uses the Playwright Chromium already installed for tests)
/* global console */
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "public");

const GLYPH = `
  <path d="M8 20a4 4 0 0 1 4-4h8l3-5h18l3 5h8a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"
        fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="32" cy="34" r="10" fill="none" stroke="#fff" stroke-width="3"/>
  <circle cx="32" cy="34" r="3" fill="#e5251b"/>
  <rect x="22" y="56" width="20" height="3.5" rx="1.75" fill="#e5251b"/>`;

// Rounded square for browsers and the home screen
const ROUNDED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="13" fill="#000"/>${GLYPH}
</svg>`;

// Full-bleed with the glyph inside the safe zone, for icon masks (Android) and iOS
const MASKABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#000"/>
  <g transform="translate(32 32) scale(0.68) translate(-32 -32)">${GLYPH}</g>
</svg>`;

const TARGETS = [
  { file: "icon-192.png", svg: ROUNDED, size: 192, transparent: true },
  { file: "icon-512.png", svg: ROUNDED, size: 512, transparent: true },
  { file: "icon-maskable-512.png", svg: MASKABLE, size: 512, transparent: false },
  { file: "apple-touch-icon.png", svg: MASKABLE, size: 180, transparent: false },
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
await browser.close();
