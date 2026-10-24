"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type maplibregl from "maplibre-gl";
import { useData } from "@/components/DataProvider";
import { Loading, Photo, Stars } from "@/components/bits";
import { useMap, fitTo } from "@/components/useMap";
import { trips, fmtRange, type Trip } from "@/lib/stats";
import { flag } from "@/lib/normalize";

export default function TripsPage() {
  return (
    <Suspense>
      <Trips />
    </Suspense>
  );
}

function Trips() {
  const { mode, checkins, loading } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const list = useMemo(() => trips(checkins), [checkins]);
  const sel: Trip | undefined = list.find((t) => t.id === params.get("trip")) ?? list[0];
  const pick = (t: Trip) => router.replace(`/stats/trips?trip=${t.id}`, { scroll: false });
  const totals = useMemo(
    () => ({ countries: new Set(list.flatMap((t) => t.countries)).size, checkins: list.reduce((n, t) => n + t.checkins.length, 0) }),
    [list],
  );

  if (loading && !checkins.length) return <Loading />;

  return (
    <div className="trips">
      <p className="muted intro">
        {list.length} trips away from SW Ontario (more than 150 km from home) · {totals.checkins.toLocaleString()} check-ins
        across {totals.countries} countries. A trip ends after 4 days with no check-ins away, or a check-in back home.
      </p>
      <div className="trips-grid">
        <ol className="trip-list">
          {list.map((t) => (
            <li key={t.id}>
              <button className={t.id === sel?.id ? "on" : ""} onClick={() => pick(t)}>
                <span className="trip-flags">{t.countryCodes.slice(0, 3).map(flag).join("")}</span>
                <span className="trip-name">
                  <b>{t.name}</b>
                  <span className="muted small">
                    {fmtRange(t.start, t.end)} · {t.days} day{t.days === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="trip-n">{t.checkins.length}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="trip-detail">{sel && <TripView trip={sel} priv={mode === "private"} />}</div>
      </div>
    </div>
  );
}

function TripView({ trip, priv }: { trip: Trip; priv: boolean }) {
  const { ref, map } = useMap();

  useEffect(() => {
    if (!map) return;
    // Route in visit order; repeat visits to a stop are collapsed
    const route = trip.checkins
      .map((c) => [c.lng!, c.lat!] as [number, number])
      .filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
    const line: GeoJSON.Feature = { type: "Feature", geometry: { type: "LineString", coordinates: route }, properties: {} };
    const stops: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: trip.stops.map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: { count: s.count },
      })),
    };
    const lineSrc = map.getSource("trip-line") as maplibregl.GeoJSONSource | undefined;
    if (lineSrc) {
      lineSrc.setData(line);
      (map.getSource("trip-stops") as maplibregl.GeoJSONSource).setData(stops);
    } else {
      map.addSource("trip-line", { type: "geojson", data: line });
      map.addSource("trip-stops", { type: "geojson", data: stops });
      map.addLayer({
        id: "trip-line",
        type: "line",
        source: "trip-line",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#f5a524", "line-width": 2, "line-opacity": 0.7, "line-dasharray": [2, 1.5] },
      });
      map.addLayer({
        id: "trip-stops",
        type: "circle",
        source: "trip-stops",
        paint: {
          "circle-color": "#f5a524",
          "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 5, 20, 12],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#161a20",
        },
      });
    }
    fitTo(map, trip.stops, 11);
  }, [map, trip]);

  const photos = priv ? trip.checkins.filter((c) => c.photo).slice(0, 12) : [];

  return (
    <div className="rv-card trip-card">
      <div className="trip-map" ref={ref} />
      <h2>
        {trip.countryCodes.slice(0, 3).map(flag).join(" ")} {trip.name}
      </h2>
      <p className="muted small">
        {fmtRange(trip.start, trip.end)} · {trip.checkins.length} check-ins · {trip.stops.length} stop
        {trip.stops.length === 1 ? "" : "s"}
        {trip.countries.length > 1 && <> · {trip.countries.join(", ")}</>}
      </p>
      <p className="trip-route small">
        {trip.stops.map((s, i) => (
          <span key={s.key}>
            {i > 0 && <span className="muted"> → </span>}
            {s.name}
            {s.count > 1 && <span className="muted"> ({s.count})</span>}
          </span>
        ))}
      </p>
      {trip.top && (
        <p className="small">
          <span className="muted">Best beer: </span>
          <b>{trip.top.beer}</b> <span className="muted">· {trip.top.brewery}</span> <Stars value={trip.top.rating} />
        </p>
      )}
      {photos.length > 0 && (
        <div className="rv-photos">
          {photos.map((c) => (
            <Link key={c.id} href={`/?loc=${c.loc}`} title={c.beer}>
              <Photo url={c.photo!} size={200} alt={c.beer} />
            </Link>
          ))}
        </div>
      )}
      <details>
        <summary className="small">All {trip.checkins.length} check-ins</summary>
        <ul className="plain small">
          {trip.checkins.map((c) => (
            <li key={c.id}>
              <b>{c.beer}</b> <span className="muted">· {c.brewery} · {priv && c.venue ? `${c.venue}, ` : ""}{c.city}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
