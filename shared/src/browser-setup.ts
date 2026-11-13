// Zod settings for the browser (import for its side effect)
//
// Must be the FIRST import in the web entry: Zod picks its mode while building each
// schema, so this has to run before the schemas load. Stops Zod probing for `eval`,
// which our CSP blocks and the browser reports as a violation
import { z } from "zod";

z.config({ jitless: true });
