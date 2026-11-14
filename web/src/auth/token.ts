// Sign-in token, kept in localStorage on this phone
//
// Never log or display it
const KEY = "lc.token";

/** 32 random bytes as base64url, which is what `npm run user:add` issues. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The token in an invite link's fragment (`#<token>`), or null if it isn't one. */
export function parseInviteHash(hash: string): string | null {
  const token = hash.startsWith("#") ? hash.slice(1) : hash;
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function createTokenStore(getStorage: () => TokenStorage = () => localStorage) {
  return {
    read(): string | null {
      try {
        const value = getStorage().getItem(KEY);
        return value !== null && TOKEN_PATTERN.test(value) ? value : null;
      } catch {
        return null; // storage blocked
      }
    },
    /** False when the browser refuses to store it (e.g. private browsing). */
    save(token: string): boolean {
      try {
        getStorage().setItem(KEY, token);
        return true;
      } catch {
        return false;
      }
    },
    clear(): void {
      try {
        getStorage().removeItem(KEY);
      } catch {
        // storage blocked: nothing to clear
      }
    },
  };
}

export const tokenStore = createTokenStore();
