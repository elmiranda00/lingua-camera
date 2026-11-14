// Creates a user and prints their invite link
//
// npm run user:add -- "Name"                   local D1 (run db:migrate:local first)
// npm run user:add -- "Name" --remote          production D1
// Options: --origin https://host   base URL for the link
// The token is printed once and never stored; only its SHA-256 goes in the database.
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_ORIGIN = "http://localhost:5173"; // Vite dev server (proxies /api to wrangler dev)
const REMOTE_ORIGIN = "https://lingua-camera.eltest.workers.dev";
const NAME_MAX_CHARS = 60;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const originIndex = args.indexOf("--origin");
const originArg = originIndex >= 0 ? args[originIndex + 1] : undefined;
if (originIndex >= 0 && !originArg) fail("--origin needs a value, e.g. --origin https://example.com");

const positional = args.filter((arg, i) => !arg.startsWith("--") && (originIndex < 0 || i !== originIndex + 1));
const name = positional.join(" ").trim();
// eslint-disable-next-line no-control-regex -- rejects control characters in names
if (!name || name.length > NAME_MAX_CHARS || /[\u0000-\u001f]/.test(name)) {
  fail(`Usage: npm run user:add -- "Name" [--remote] [--origin URL]  (name: 1-${NAME_MAX_CHARS} characters)`);
}

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const sqlText = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sql = `INSERT INTO users (id, name, token_hash) VALUES (${sqlText(randomUUID())}, ${sqlText(name)}, ${sqlText(tokenHash)})`;

// Run wrangler from /worker so it finds wrangler.jsonc; the token itself never reaches it.
const wrangler = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const result = spawnSync(
  process.execPath,
  [wrangler, "d1", "execute", "DB", remote ? "--remote" : "--local", "--env=", "--command", sql],
  { cwd: join(root, "worker"), stdio: "inherit" },
);
if (result.status !== 0) fail("Could not create the user (see wrangler output above).");

const origin = (originArg ?? (remote ? REMOTE_ORIGIN : LOCAL_ORIGIN)).replace(/\/+$/, "");
console.log(`\nCreated ${remote ? "production" : "local"} user "${name}".`);
console.log("Invite link (shown once, keep it private):\n");
console.log(`  ${origin}/join#${token}\n`);
