// Invite-link sign-in: check the token with the server, then keep it
//
// The token is verified before it is saved, and the address bar is cleared only on success
import { ApiRequestError } from "../api/client.ts";
import { parseInviteHash } from "./token.ts";

export type JoinResult =
  | { status: "signed-in"; name: string }
  | { status: "not-saved"; name: string } // token is valid but the browser won't store it
  | { status: "no-link" } // opened /join without a link and not signed in
  | { status: "bad-link" } // a fragment that isn't a token (copied only in part)
  | { status: "rejected" } // unknown or disabled
  | { status: "unreachable" };

export interface JoinDeps {
  hash: string;
  getMe: (token: string) => Promise<{ name: string }>;
  store: { read(): string | null; save(token: string): boolean; clear(): void };
  clearAddress: () => void;
}

async function verify(token: string, getMe: JoinDeps["getMe"]): Promise<{ name: string } | JoinResult> {
  try {
    return await getMe(token);
  } catch (error) {
    return error instanceof ApiRequestError && error.code === "unauthorized"
      ? { status: "rejected" }
      : { status: "unreachable" };
  }
}

export async function completeJoin({ hash, getMe, store, clearAddress }: JoinDeps): Promise<JoinResult> {
  const invite = parseInviteHash(hash);
  if (!invite && hash.length > 1) return { status: "bad-link" };

  // Already signed in, opened without a link
  const token = invite ?? store.read();
  if (!token) return { status: "no-link" };

  const me = await verify(token, getMe);
  if ("status" in me) {
    if (me.status === "rejected" && !invite) store.clear(); // the saved token no longer works
    return me;
  }

  if (invite) {
    if (!store.save(invite)) return { status: "not-saved", name: me.name };
    clearAddress();
  }
  return { status: "signed-in", name: me.name };
}
