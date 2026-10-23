// Dev helper: normalize an Untappd export into the gitignored local store.
// Usage: node scripts/import-local.mts <export.json>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { normalize, type ExportRow } from "../src/lib/normalize.ts";

const file = process.argv[2];
if (!file) throw new Error("usage: node scripts/import-local.mts <export.json>");
const rows = JSON.parse(readFileSync(file, "utf8")) as ExportRow[];
mkdirSync("data", { recursive: true });
writeFileSync("data/checkins.local.json", JSON.stringify(rows.map(normalize)));
console.log(`wrote ${rows.length} check-ins to data/checkins.local.json`);
