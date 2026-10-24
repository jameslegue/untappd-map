import type { Checkin } from "./types";
import { homeLocation, isHomeVenue } from "./normalize";

// Untappd's per-user RSS feed (URL from untappd.com/account/settings). Each item
// is a text summary like "James L. is drinking a Hazy IPA by Some Brewery at Some Bar",
// a check-in link, a date and maybe a photo. No coordinates, so venues are matched
// against ones we already know from the export.

export type RssItem = {
  id: number;
  title: string;
  link: string;
  date: string;
  description: string;
  image: string | null;
};

const decode = (s: string) =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function imageOf(item: string, description: string): string | null {
  const enclosure = item.match(/<(?:enclosure|media:content|media:thumbnail)[^>]*\surl="([^"]+)"/i);
  if (enclosure) return decode(enclosure[1]);
  const img = description.match(/<img[^>]*\ssrc="([^"]+)"/i);
  return img ? decode(img[1]) : null;
}

export function parseFeed(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const link = tag(item, "link");
    const guid = tag(item, "guid");
    // Check-in links end in the check-in id, e.g. /user/<name>/checkin/1534567890
    const idMatch = (link.match(/checkin\/(\d+)/) ?? guid.match(/checkin\/(\d+)/) ?? link.match(/(\d{6,})\/?$/))?.[1];
    if (!idMatch) continue;
    const description = tag(item, "description");
    items.push({
      id: Number(idMatch),
      title: tag(item, "title"),
      link,
      date: tag(item, "pubDate") || tag(item, "dc:date"),
      description,
      image: imageOf(item, description),
    });
  }
  return items;
}

// "<Name> is drinking a(n) <beer> by <brewery>[ at <venue>]"
export function parseTitle(title: string) {
  const m = title.match(/is drinking an?\s+(.+)\s+by\s+(.+?)(?:\s+at\s+(.+))?$/i);
  if (!m) return null;
  return { beer: m[1].trim(), brewery: m[2].trim(), venue: m[3]?.trim() || null };
}

const venueKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Most recent known location for each venue name, from export rows
export function venueIndex(existing: Checkin[]) {
  const idx = new Map<string, Checkin>();
  for (const c of existing) {
    if (c.src === "rss" || !c.venue || c.home || c.lat == null) continue;
    const k = venueKey(c.venue);
    const prev = idx.get(k);
    if (!prev || prev.t < c.t) idx.set(k, c);
  }
  return idx;
}

export function toCheckin(item: RssItem, venues: Map<string, Checkin>): Checkin | null {
  const parsed = parseTitle(item.title);
  if (!parsed) return null;
  const t = new Date(item.date);
  const comment = item.description
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base: Checkin = {
    id: item.id,
    t: Number.isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString(),
    beer: parsed.beer,
    brewery: parsed.brewery,
    breweryCountry: "",
    style: "",
    abv: null,
    rating: null,
    serving: "",
    loc: null,
    lat: null,
    lng: null,
    city: "",
    state: "",
    country: "",
    countryCode: "",
    venue: parsed.venue ?? undefined,
    comment,
    photo: item.image,
    url: item.link || undefined,
    src: "rss",
  };
  if (!parsed.venue) return base;
  if (isHomeVenue(parsed.venue)) return { ...base, ...homeLocation(item.id) };
  const known = venues.get(venueKey(parsed.venue));
  if (!known) return base; // new venue - placed when the next export is uploaded
  return {
    ...base,
    loc: known.loc,
    lat: known.lat,
    lng: known.lng,
    city: known.city,
    state: known.state,
    country: known.country,
    countryCode: known.countryCode,
    venue: known.venue,
  };
}
