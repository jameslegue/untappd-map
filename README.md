# Tapped Out

Every place I've checked in a beer on Untappd, on a map.

- **Map** - clustered pins for every venue; click one for the check-ins and photos
- **Passport** - a stamp per country, with regions and cities inside
- **Replay** - watch the map fill in over time
- **Mosaic** - check-in photos tiled across the map (unlocked only)
- **Wall** - polaroids grouped by city or venue (unlocked only)

## Privacy

Locked visitors get `/api/public`: every check-in snapped to a city-level point
(1 decimal of lat/lng), with no venue names, photos, comments or check-in IDs.
Exact venues, photos and notes come from `/api/private`, which needs the site
password. The filtering happens on the server, not in the browser.

"Untappd at Home" check-ins are spread across Waterloo, London and Bayfield, ON
(city centres only). Virtual venues pinned to Untappd's HQ are treated as having
no location.

**Never commit an export file** - this repo is public. `/data` and `*.export.json`
are gitignored.

## Data

1. **Backfill (once):** the Untappd Insider export (Untappd → Account → Download
   History → JSON). Unlock the site, go to **Admin**, upload it.
2. **Hourly:** a GitHub Action (`.github/workflows/sync.yml`) calls `/api/sync`,
   which reads your Untappd RSS feed and adds any check-ins it hasn't seen.
   - The feed has no coordinates, so new check-ins are placed using venues
     already on the map (and "Untappd at Home" → the home cities). A venue
     you've never been to stays off the map until the next export upload.
   - The feed has no ratings/styles either. Re-uploading an export fills those
     in - export rows always replace RSS rows; RSS never overwrites export rows.
   - **Sync now** on `/admin` runs it on demand.

## Deploying (Vercel)

1. Import this repo into Vercel.
2. **Storage → Create → Neon Postgres**, connected to the project. This sets
   `DATABASE_URL`. The table is created on first use.
3. Add environment variables:
   - `SITE_PASSWORD` - the unlock password
   - `SESSION_SECRET` - a long random string (`openssl rand -hex 32`)
   - `CRON_SECRET` - another long random string
   - `UNTAPPD_RSS_URL` - your feed URL from untappd.com/account/settings
     (it has a private key in it - keep it out of the repo)
4. Redeploy, unlock, and upload the export on `/admin`. Hit **Sync now** to
   check the feed parses.
5. In GitHub → repo Settings → Secrets and variables → Actions:
   - Secret `CRON_SECRET` - same value as in Vercel
   - Variable `SITE_URL` - e.g. `https://untappd-map.vercel.app`

   The hourly job skips itself until `SITE_URL` is set.

Photos are hotlinked from Untappd's S3. Newer uploads only exist at full size,
so those go through Vercel's image optimizer (resized and cached).

## Local dev

```bash
npm install
node scripts/import-local.mts path/to/export.json   # writes data/checkins.local.json
npm run dev                                         # password is "dev"
```

Without `DATABASE_URL` the app reads and writes `data/checkins.local.json`.
