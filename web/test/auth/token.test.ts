import { describe, expect, it } from "vitest";
import { createTokenStore, parseInviteHash } from "../../src/auth/token.ts";

const TOKEN = "ww_XD96oHXQuxFnP6bdFClnRVou9W4W4bi3WBlB34qI"; // 43 characters, as user:add issues

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const blocked = () => {
  throw new DOMException("denied", "SecurityError");
};

describe("parseInviteHash", () => {
  it("reads the token from a fragment", () => {
    expect(parseInviteHash(`#${TOKEN}`)).toBe(TOKEN);
  });

  it.each([["empty", ""], ["just #", "#"], ["too short", "#abc"], ["wrong characters", `#${TOKEN.slice(1)}!`], ["too long", `#${TOKEN}x`]])(
    "rejects %s",
    (_label, hash) => {
      expect(parseInviteHash(hash)).toBeNull();
    },
  );
});

describe("token store", () => {
  it("saves, reads and clears", () => {
    const storage = fakeStorage();
    const store = createTokenStore(() => storage);
    expect(store.read()).toBeNull();
    expect(store.save(TOKEN)).toBe(true);
    expect(store.read()).toBe(TOKEN);
    store.clear();
    expect(store.read()).toBeNull();
  });

  it("ignores a stored value that isn't a token", () => {
    const storage = fakeStorage();
    storage.setItem("lc.token", "garbage");
    expect(createTokenStore(() => storage).read()).toBeNull();
  });

  it("copes with blocked storage", () => {
    const store = createTokenStore(blocked);
    expect(store.read()).toBeNull();
    expect(store.save(TOKEN)).toBe(false);
    expect(() => store.clear()).not.toThrow();
  });
});
