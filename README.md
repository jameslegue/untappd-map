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

There's no Untappd API key, so data comes from the Insider export
(Untappd → Account → Download History → JSON):

1. Unlock the site, go to **Admin**, and upload the JSON.
2. To update later, export again and re-upload. Check-ins are matched by ID, so
   nothing gets duplicated.

## Deploying (Vercel)

1. Import this repo into Vercel.
2. **Storage → Create → Neon Postgres**, connected to the project. This sets
   `DATABASE_URL`. The table is created on first use.
3. Add environment variables:
   - `SITE_PASSWORD` - the unlock password
   - `SESSION_SECRET` - a long random string (`openssl rand -hex 32`)
4. Redeploy, unlock, and upload the export on `/admin`.

Photos are hotlinked from Untappd's S3. Newer uploads only exist at full size,
so those go through Vercel's image optimizer (resized and cached).

## Local dev

```bash
npm install
node scripts/import-local.mts path/to/export.json   # writes data/checkins.local.json
npm run dev                                         # password is "dev"
```

Without `DATABASE_URL` the app reads and writes `data/checkins.local.json`.
