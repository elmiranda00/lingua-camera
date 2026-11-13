import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { patchOpencv } from "../../vite-plugins/opencvCsp.ts";

describe("patchOpencv", () => {
  it("replaces createNamedFunction with a plain wrapper", () => {
    const src = `return new Function("body","return function "+name+"() {\n"+'    "use strict";'+"    return body.apply(this, arguments);\n"+"};\n")(body)}`;
    expect(patchOpencv(src)).toBe("return (function(){return body.apply(this,arguments)})}");
  });

  it("replaces the dynCall wrapper", () => {
    const src = `return new Function("dynCall","rawFunction",body)(dynCall,rawFunction)}`;
    expect(patchOpencv(src)).toBe("return (function(){return dynCall(rawFunction,...arguments)})}");
  });

  it("skips fetching the embedded data: URL", () => {
    const src = `if(!wasmBinary&&(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER)&&typeof fetch==="function"){return fetch(wasmBinaryFile,{})}`;
    expect(patchOpencv(src)).toContain(`typeof fetch==="function"&&!isDataURI(wasmBinaryFile)){return fetch(`);
  });

  it("leaves other code alone", () => {
    expect(patchOpencv("const a = 1; function foo() {}")).toBe("const a = 1; function foo() {}");
  });

  // Guards against an OpenCV update silently changing the patched code
  it("removes every eval site and the data: fetch from the installed opencv.js", () => {
    const require = createRequire(import.meta.url);
    const out = patchOpencv(readFileSync(require.resolve("@techstark/opencv-js"), "utf8"));
    expect(out).not.toMatch(/new Function|[^\w.]Function\(|new_\(Function/);
    expect(out).toContain(`typeof fetch==="function"&&!isDataURI(wasmBinaryFile)`);
  });
});
