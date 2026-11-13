import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pub = (name: string) => new URL(`../../public/${name}`, import.meta.url);
const manifest = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8")) as {
  name: string;
  start_url: string;
  display: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};

// PNG width and height sit at fixed offsets in the header
const pngSize = (file: string) => {
  const buf = readFileSync(pub(file));
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
};

describe("web app manifest", () => {
  it("can be installed (name, start page, standalone)", () => {
    expect(manifest.name).toBe("Lingua Camera");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("lists icons that exist at the declared size", () => {
    for (const icon of manifest.icons) {
      expect(pngSize(icon.src.slice(1)), icon.src).toBe(icon.sizes);
    }
  });

  it("has 192 and 512 icons and a maskable one", () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("has the iOS home-screen icon at 180x180", () => {
    expect(pngSize("apple-touch-icon.png")).toBe("180x180");
  });

  it("is linked from index.html", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
  });
});
