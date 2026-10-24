// One check-in, as served to the browser. Public payloads leave the optional
// fields out and snap lat/lng to a coarse city point.
export type Checkin = {
  id: number;
  t: string; // ISO timestamp (UTC)
  off?: number; // UTC offset in minutes where the check-in happened
  beer: string;
  brewery: string;
  breweryCountry: string;
  style: string;
  abv: number | null;
  rating: number | null;
  globalRating?: number | null; // Untappd community average for the beer
  serving: string;
  // Location - null when the check-in has no real venue
  loc: string | null; // grouping key (venue id privately, city key publicly)
  lat: number | null;
  lng: number | null;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  // Unlocked only
  venue?: string;
  home?: boolean;
  comment?: string;
  photo?: string | null;
  url?: string;
  src?: "rss"; // partial row from the RSS sync; the next export upload replaces it
};

export type Mode = "public" | "private";

export type Payload = {
  mode: Mode;
  checkins: Checkin[];
};
