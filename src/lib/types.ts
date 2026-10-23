// One check-in, as served to the browser. Public payloads leave the optional
// fields out and snap lat/lng to a coarse city point.
export type Checkin = {
  id: number;
  t: string; // ISO timestamp
  beer: string;
  brewery: string;
  breweryCountry: string;
  style: string;
  abv: number | null;
  rating: number | null;
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
};

export type Mode = "public" | "private";

export type Payload = {
  mode: Mode;
  checkins: Checkin[];
};
