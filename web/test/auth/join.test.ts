import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../src/api/client.ts";
import { completeJoin, type JoinDeps } from "../../src/auth/join.ts";

const TOKEN = "ww_XD96oHXQuxFnP6bdFClnRVou9W4W4bi3WBlB34qI";
const OTHER = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function setup(overrides: Partial<JoinDeps> & { saved?: string | null; canSave?: boolean } = {}) {
  let saved = overrides.saved ?? null;
  const store = {
    read: vi.fn(() => saved),
    save: vi.fn((token: string) => {
      if (overrides.canSave === false) return false;
      saved = token;
      return true;
    }),
    clear: vi.fn(() => {
      saved = null;
    }),
  };
  const clearAddress = vi.fn();
  const getMe = vi.fn(overrides.getMe ?? (async () => ({ name: "Elrich" })));
  const deps: JoinDeps = { hash: overrides.hash ?? "", getMe, store, clearAddress };
  return { deps, store, clearAddress, getMe };
}

const apiError = (code: ConstructorParameters<typeof ApiRequestError>[0]) => () =>
  Promise.reject(new ApiRequestError(code, "x", code === "unauthorized" ? 401 : null, null));

describe("completeJoin with an invite link", () => {
  it("verifies, saves, clears the address bar and reports the name", async () => {
    const { deps, store, clearAddress, getMe } = setup({ hash: `#${TOKEN}` });
    await expect(completeJoin(deps)).resolves.toEqual({ status: "signed-in", name: "Elrich" });
    expect(getMe).toHaveBeenCalledWith(TOKEN);
    expect(store.save).toHaveBeenCalledWith(TOKEN);
    expect(clearAddress).toHaveBeenCalledOnce();
  });

  it("saves nothing and keeps the link when the server rejects the token", async () => {
    const { deps, store, clearAddress } = setup({ hash: `#${TOKEN}`, getMe: apiError("unauthorized"), saved: OTHER });
    await expect(completeJoin(deps)).resolves.toEqual({ status: "rejected" });
    expect(store.save).not.toHaveBeenCalled();
    expect(store.clear).not.toHaveBeenCalled(); // an earlier working sign-in survives a bad link
    expect(clearAddress).not.toHaveBeenCalled();
  });

  it("saves nothing when the server can't be reached", async () => {
    const { deps, store, clearAddress } = setup({ hash: `#${TOKEN}`, getMe: apiError("network") });
    await expect(completeJoin(deps)).resolves.toEqual({ status: "unreachable" });
    expect(store.save).not.toHaveBeenCalled();
    expect(clearAddress).not.toHaveBeenCalled();
  });

  it("says so when the browser won't store the token", async () => {
    const { deps, clearAddress } = setup({ hash: `#${TOKEN}`, canSave: false });
    await expect(completeJoin(deps)).resolves.toEqual({ status: "not-saved", name: "Elrich" });
    expect(clearAddress).not.toHaveBeenCalled();
  });

  it("flags a link that isn't a whole token without calling the server", async () => {
    const { deps, getMe } = setup({ hash: "#abc" });
    await expect(completeJoin(deps)).resolves.toEqual({ status: "bad-link" });
    expect(getMe).not.toHaveBeenCalled();
  });
});

describe("completeJoin without a link", () => {
  it("asks for the link when not signed in", async () => {
    const { deps, getMe } = setup();
    await expect(completeJoin(deps)).resolves.toEqual({ status: "no-link" });
    expect(getMe).not.toHaveBeenCalled();
  });

  it("confirms an existing sign-in", async () => {
    const { deps, getMe, store } = setup({ saved: TOKEN });
    await expect(completeJoin(deps)).resolves.toEqual({ status: "signed-in", name: "Elrich" });
    expect(getMe).toHaveBeenCalledWith(TOKEN);
    expect(store.save).not.toHaveBeenCalled();
  });

  it("forgets a saved token the server no longer accepts", async () => {
    const { deps, store } = setup({ saved: TOKEN, getMe: apiError("unauthorized") });
    await expect(completeJoin(deps)).resolves.toEqual({ status: "rejected" });
    expect(store.clear).toHaveBeenCalledOnce();
  });

  it("keeps a saved token when the server just can't be reached", async () => {
    const { deps, store } = setup({ saved: TOKEN, getMe: apiError("timeout") });
    await expect(completeJoin(deps)).resolves.toEqual({ status: "unreachable" });
    expect(store.clear).not.toHaveBeenCalled();
  });
});
