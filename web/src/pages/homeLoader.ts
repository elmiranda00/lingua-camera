// Loads the API version for the home page
//
// Failure is not fatal: the page still renders and shows "API unreachable"
import { api } from "../api/client.ts";

export async function homeLoader(): Promise<{ version: string | null }> {
  try {
    const health = await api.getHealth();
    return { version: health.version };
  } catch {
    // The client has already logged the failure with its request ID
    return { version: null };
  }
}
