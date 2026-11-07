import "server-only";
import { after } from "next/server";
import { claimSync, getCheckins, upsertCheckins } from "./store";
import { parseFeed, toCheckin, venueIndex, type RssItem } from "./rss";
import { enrich, parseProfile, type ProfileItem } from "./profile";
import type { Checkin } from "./types";

export type SyncResult = {
  fetched: number;
  added: number;
  unplaced: number;
  skipped: number;
  sources: { profile: string; rss: string };
};

const UA = "jimmylegs.beer/1.0 (personal check-in map)";
const PROFILE_USER = process.env.UNTAPPD_USERNAME || "jameslegue";

async function fromProfile(): Promise<ProfileItem[]> {
  const res = await fetch(`https://untappd.com/user/${PROFILE_USER}`, {
    headers: { "User-Agent": `Mozilla/5.0 (compatible; ${UA})` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`profile ${res.status}`);
  return parseProfile(await res.text(), PROFILE_USER);
}

async function fromRss(): Promise<RssItem[]> {
  const url = process.env.UNTAPPD_RSS_URL;
  if (!url) throw new Error("UNTAPPD_RSS_URL not set");
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`rss ${res.status}`);
  return parseFeed(await res.text());
}

const describe = (r: PromiseSettledResult<unknown[]>) =>
  r.status === "fulfilled" ? `${r.value.length} items` : `failed (${(r.reason as Error).message})`;

// Pull recent check-ins from the profile page (instant) and the RSS feed
// (backup), and insert any we haven't seen. Never overwrites export rows.
export async function syncFromRss(): Promise<SyncResult> {
  const [profile, rss] = await Promise.allSettled([fromProfile(), fromRss()]);
  if (profile.status === "rejected" && rss.status === "rejected") {
    throw new Error(`profile: ${(profile.reason as Error).message}; rss: ${(rss.reason as Error).message}`);
  }
  const byId = new Map<number, RssItem | ProfileItem>();
  if (rss.status === "fulfilled") for (const i of rss.value) byId.set(i.id, i);
  if (profile.status === "fulfilled") for (const i of profile.value) byId.set(i.id, i); // richer, wins

  const existing = await getCheckins();
  const have = new Set(existing.map((c) => c.id));
  const venues = venueIndex(existing);
  const fresh = [...byId.values()].filter((i) => !have.has(i.id));
  const rows = fresh
    .map((i) => {
      const c = toCheckin(i, venues);
      return c && "venueId" in i ? enrich(c, i, existing) : c;
    })
    .filter((c): c is Checkin => c !== null);

  const added = rows.length ? await upsertCheckins(rows, { overwrite: false }) : 0;
  return {
    fetched: byId.size,
    added,
    unplaced: rows.filter((r) => r.lat == null).length,
    skipped: fresh.length - rows.length,
    sources: { profile: describe(profile), rss: describe(rss) },
  };
}

// Sync on page load when the last sync is stale, so a fresh check-in shows up
// as soon as the site is opened. Waits up to timeoutMs; a slower sync carries
// on after the response is sent instead of being cut off.
export async function syncIfStale({ minutes = 3, timeoutMs = 4000 } = {}) {
  try {
    if (!(await claimSync(minutes))) return;
    const run = syncFromRss().catch(() => {
      // The hourly job and "Sync now" will retry
    });
    after(() => run);
    await Promise.race([run, new Promise((r) => setTimeout(r, timeoutMs))]);
  } catch {
    // Never let a sync problem break the page
  }
}
