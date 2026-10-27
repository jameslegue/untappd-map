import "server-only";
import { claimSync, getCheckins, upsertCheckins } from "./store";
import { parseFeed, toCheckin, venueIndex } from "./rss";

export type SyncResult = { fetched: number; added: number; unplaced: number; skipped: number };

export async function syncFromRss(): Promise<SyncResult> {
  const url = process.env.UNTAPPD_RSS_URL;
  if (!url) throw new Error("UNTAPPD_RSS_URL is not set");

  const res = await fetch(url, {
    headers: { "User-Agent": "jimmylegs.beer/1.0 (personal check-in map)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const items = parseFeed(await res.text());

  const existing = await getCheckins();
  const have = new Set(existing.map((c) => c.id));
  const venues = venueIndex(existing);
  const fresh = items.filter((i) => !have.has(i.id));
  const rows = fresh.map((i) => toCheckin(i, venues)).filter((c) => c !== null);

  const added = rows.length ? await upsertCheckins(rows, { overwrite: false }) : 0;
  return {
    fetched: items.length,
    added,
    unplaced: rows.filter((r) => r.lat == null).length,
    skipped: fresh.length - rows.length,
  };
}

// Sync on page load when the last sync is stale, so a fresh check-in shows up
// as soon as the site is opened. Bounded so a slow feed never holds up a page.
export async function syncIfStale({ minutes = 10, timeoutMs = 4000 } = {}) {
  if (!process.env.UNTAPPD_RSS_URL) return;
  try {
    if (!(await claimSync(minutes))) return;
    await Promise.race([syncFromRss(), new Promise((r) => setTimeout(r, timeoutMs))]);
  } catch {
    // The hourly job and "Sync now" will retry
  }
}
