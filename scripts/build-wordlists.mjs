// Builds the tier word lists in web/src/tiers/data from pinned sources (output is committed)
// Sources are checked against SHA-256 hashes. Raw downloads go to the gitignored .cache/.
/* global console, fetch, Buffer */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, ".cache", "wordlists");
const outDir = join(root, "web", "src", "tiers", "data");

const SOURCES = {
  lexique: {
    url: "https://www.lexique.org/databases/Lexique383/Lexique383.zip",
    sha256: "e181d132b3b0d3d87efc98d376968441b517353933011cebea5366321a6024e6",
  },
  hsk: {
    url: "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/7ac65bf1a6387d35f1ade478906172a19311c7f9/wordlists/inclusive/new/2.json",
    sha256: "11405342fc3f873c50841d09ea5a3a8b60fc9691dcce6fb94afe45ab12aecc8f",
  },
};

const FR_TOP_LEMMAS = 2000;

async function get(name, file) {
  const { url, sha256 } = SOURCES[name];
  const path = join(cache, file);
  try {
    const bytes = await readFile(path);
    if (createHash("sha256").update(bytes).digest("hex") === sha256) return path;
  } catch {
    // not cached yet
  }
  console.log(`downloading ${name}`);
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`${name}: hash mismatch`);
  await writeFile(path, bytes);
  return path;
}

// Minimal zip reader: finds one entry in the central directory and inflates it
function unzipEntry(zip, name) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let pos = zip.readUInt32LE(eocd + 16);
  for (let n = zip.readUInt16LE(eocd + 10); n > 0; n--) {
    const method = zip.readUInt16LE(pos + 10);
    const size = zip.readUInt32LE(pos + 20);
    const nameLen = zip.readUInt16LE(pos + 28);
    const extraLen = zip.readUInt16LE(pos + 30);
    const commentLen = zip.readUInt16LE(pos + 32);
    const local = zip.readUInt32LE(pos + 42);
    if (zip.toString("utf8", pos + 46, pos + 46 + nameLen) === name) {
      const data = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const raw = zip.subarray(data, data + size);
      return method === 0 ? raw : inflateRawSync(raw);
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${name} not in zip`);
}

await mkdir(cache, { recursive: true });
await mkdir(outDir, { recursive: true });

// French: all forms of the 2,000 most frequent lemmas (subtitle + book frequency)
const zip = await readFile(await get("lexique", "Lexique383.zip"));
const tsv = unzipEntry(zip, "Lexique383.tsv").toString("utf8");
const [header, ...rows] = tsv.split("\n").filter(Boolean).map((l) => l.split("\t"));
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const lemmaFreq = new Map();
for (const r of rows) {
  const f = Number(r[col.freqlemfilms2]) + Number(r[col.freqlemlivres]);
  const lemma = r[col.lemme];
  if (f > (lemmaFreq.get(lemma) ?? -1)) lemmaFreq.set(lemma, f);
}
const top = new Set([...lemmaFreq].sort((a, b) => b[1] - a[1]).slice(0, FR_TOP_LEMMAS).map(([l]) => l));
const forms = new Set(rows.filter((r) => top.has(r[col.lemme])).map((r) => r[col.ortho].normalize("NFC").toLowerCase()));
await writeFile(join(outDir, "fr-common.json"), JSON.stringify([...forms].sort((a, b) => a.localeCompare(b, "fr"))) + "\n");

// Chinese: HSK 3.0 levels 1-2 words
const hsk = JSON.parse(await readFile(await get("hsk", "hsk3-level2.json"), "utf8"));
const words = [...new Set(hsk.map((e) => e.simplified.normalize("NFC")))].sort();
await writeFile(join(outDir, "zh-hsk12.json"), JSON.stringify(words) + "\n");

console.log(`fr-common: ${forms.size} forms from ${top.size} lemmas; zh-hsk12: ${words.length} words`);
