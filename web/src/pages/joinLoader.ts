// Runs the invite-link sign-in for /join
import { api } from "../api/client.ts";
import { completeJoin, type JoinResult } from "../auth/join.ts";
import { tokenStore } from "../auth/token.ts";

export function joinLoader(): Promise<JoinResult> {
  return completeJoin({
    hash: window.location.hash,
    getMe: (token) => api.getMe(token),
    store: tokenStore,
    // Keep the router's history state; only the fragment goes
    clearAddress: () =>
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search),
  });
}
