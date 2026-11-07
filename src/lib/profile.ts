import type { Checkin } from "./types";
import type { RssItem } from "./rss";

// The public profile page (untappd.com/user/<name>) lists recent check-ins the
// moment they happen, whereas the RSS feed can lag by an hour or more. It also
// carries the rating, serving and venue id, which the feed does not.

export type ProfileItem = RssItem & { rating: number | null; serving: string; venueId: number | null };

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

export function parseProfile(html: string, user: string): ProfileItem[] {
  const items: ProfileItem[] = [];
  for (const block of html.split(/<div class="item\s*" id="checkin_/).slice(1)) {
    const id = Number(block.match(/^(\d+)"/)?.[1]);
    const text = block.match(/<p class="text"[^>]*>([\s\S]*?)<\/p>/)?.[1];
    if (!id || !text) continue;
    const rating = Number(block.match(/data-rating="([\d.]+)"/)?.[1]);
    const photo = block.match(/<p class="photo">[\s\S]*?(https:\/\/untappd\.s3\.amazonaws\.com\/[^"&\s]+)/)?.[1] ?? null;
    items.push({
      id,
      title: decode(text),
      link: `https://untappd.com/user/${user}/checkin/${id}`,
      date: decode(block.match(/class="time[^"]*"[^>]*>([^<]+)</)?.[1] ?? ""),
      description: decode(block.match(/<p class="comment-text"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ""),
      image: photo,
      rating: rating > 0 ? rating : null,
      serving: decode(block.match(/<p class="serving">[\s\S]*?<span>([^<]*)<\/span>/)?.[1] ?? ""),
      venueId: Number(block.match(/href="\/v\/[^/"]+\/(\d+)"/)?.[1]) || null,
    });
  }
  return items;
}

// Fill in what the profile knows beyond the RSS-style title
export function enrich(c: Checkin, p: ProfileItem, existing: Checkin[]): Checkin {
  const out: Checkin = { ...c, rating: p.rating ?? c.rating, serving: p.serving || c.serving };
  if (out.lat == null && p.venueId) {
    // Venue name didn't match but its id is known from the export
    const known = existing.find((e) => e.loc === `v${p.venueId}` && e.lat != null);
    if (known) {
      Object.assign(out, {
        loc: known.loc, lat: known.lat, lng: known.lng, city: known.city, state: known.state,
        country: known.country, countryCode: known.countryCode, venue: known.venue,
      });
    }
  }
  return out;
}
