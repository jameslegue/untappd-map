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

// Insert or replace by check-in id, so re-uploading an export is safe.
// With overwrite=false existing rows win (the RSS sync never clobbers export data).
export async function upsertCheckins(rows: Checkin[], { overwrite = true } = {}): Promise<number> {
  cache = null;
  const sql = db();
  if (sql) {
    await ensureTable(sql);
    const res = (await sql.query(
      `insert into checkins (id, data)
       select (e->>'id')::bigint, e from jsonb_array_elements($1::jsonb) e
       on conflict (id) do ${overwrite ? "update set data = excluded.data, updated_at = now()" : "nothing"}
       returning id`,
      [JSON.stringify(rows)],
    )) as unknown[];
    return res.length;
  }
  let existing: Checkin[] = [];
  try {
    existing = JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
  } catch {}
  const byId = new Map(existing.map((c) => [c.id, c]));
  let n = 0;
  for (const r of rows) {
    if (!overwrite && byId.has(r.id)) continue;
    byId.set(r.id, r);
    n++;
  }
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify([...byId.values()]));
  return n;
}

let localLastClaim = 0;

// Atomically claim the right to run a sync if none has run in `minutes`.
// Returns false when another request synced recently (or is syncing now).
export async function claimSync(minutes: number): Promise<boolean> {
  const sql = db();
  if (!sql) {
    if (Date.now() - localLastClaim < minutes * 60_000) return false;
    localLastClaim = Date.now();
    return true;
  }
  await sql`create table if not exists meta (key text primary key, at timestamptz not null)`;
  const rows = (await sql.query(
    `insert into meta (key, at) values ('last_sync', now())
     on conflict (key) do update set at = now()
       where meta.at < now() - make_interval(mins => $1)
     returning at`,
    [minutes],
  )) as unknown[];
  return rows.length > 0;
}
