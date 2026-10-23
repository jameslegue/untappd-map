import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import type { Checkin } from "./types";

// Postgres (Neon via Vercel) when DATABASE_URL is set, otherwise a gitignored
// local JSON file for development.
const LOCAL_FILE = path.join(process.cwd(), "data", "checkins.local.json");
const CACHE_MS = 60_000;

let cache: { at: number; rows: Checkin[] } | null = null;

function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return url ? neon(url) : null;
}

async function ensureTable(sql: NonNullable<ReturnType<typeof db>>) {
  await sql`create table if not exists checkins (
    id bigint primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
  )`;
}

export async function getCheckins(): Promise<Checkin[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  let rows: Checkin[];
  const sql = db();
  if (sql) {
    await ensureTable(sql);
    const res = (await sql`select data from checkins`) as { data: Checkin }[];
    rows = res.map((r) => r.data);
  } else {
    try {
      rows = JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
    } catch {
      rows = [];
    }
  }
  rows.sort((a, b) => a.t.localeCompare(b.t));
  cache = { at: Date.now(), rows };
  return rows;
}

// Insert or replace by check-in id, so re-uploading an export is safe
export async function upsertCheckins(rows: Checkin[]): Promise<number> {
  cache = null;
  const sql = db();
  if (sql) {
    await ensureTable(sql);
    await sql.query(
      `insert into checkins (id, data)
       select (e->>'id')::bigint, e from jsonb_array_elements($1::jsonb) e
       on conflict (id) do update set data = excluded.data, updated_at = now()`,
      [JSON.stringify(rows)],
    );
    return rows.length;
  }
  let existing: Checkin[] = [];
  try {
    existing = JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
  } catch {}
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const r of rows) byId.set(r.id, r);
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify([...byId.values()]));
  return rows.length;
}
