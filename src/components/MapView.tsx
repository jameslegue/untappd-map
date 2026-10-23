"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type maplibregl from "maplibre-gl";
import { useData } from "./DataProvider";
import { useMap, fitTo } from "./useMap";
import { CheckinCard, Loading } from "./bits";
import { places, stats, type Place } from "@/lib/group";

const PAGE = 25;

export function MapView() {
  const { mode, checkins, loading } = useData();
  const { ref, map } = useMap();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get("loc"));
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => places(checkins, mode), [checkins, mode]);
  const byLoc = useMemo(() => new Map(list.map((p) => [p.loc, p])), [list]);
  const s = useMemo(() => stats(checkins), [checkins]);
  const place: Place | undefined = selected ? byLoc.get(selected) : undefined;

  // Data layers
  useEffect(() => {
    if (!map || !list.length) return;
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: list.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { loc: p.loc, count: p.checkins.length },
      })),
    };
    const src = map.getSource("places") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
      return;
    }
    map.addSource("places", {
      type: "geojson",
      data,
      cluster: true,
      clusterRadius: 42,
      clusterMaxZoom: 13,
      clusterProperties: { total: ["+", ["get", "count"]] },
    });
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "places",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ["step", ["get", "total"], "#c27c12", 50, "#f5a524", 250, "#ffcf70"],
        "circle-radius": ["step", ["get", "total"], 14, 50, 19, 250, 25, 1000, 32],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(255,207,112,0.35)",
      },
    });
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "places",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["to-string", ["get", "total"]],
        "text-font": ["Montserrat Medium"],
        "text-size": 12,
      },
      paint: { "text-color": "#1a1205" },
    });
    map.addLayer({
      id: "points",
      type: "circle",
      source: "places",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#f5a524",
        "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 6, 20, 11, 100, 16],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#1a1205",
      },
    });
    map.addLayer({
      id: "selected",
      type: "circle",
      source: "places",
      filter: ["==", ["get", "loc"], ""],
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 20,
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
      },
    });

    map.on("click", "clusters", async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const zoom = await (map.getSource("places") as maplibregl.GeoJSONSource).getClusterExpansionZoom(
        f.properties.cluster_id,
      );
      map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
    });
    map.on("click", "points", (e) => {
      const loc = e.features?.[0]?.properties.loc;
      if (loc) setSelected(loc);
    });
    for (const id of ["clusters", "points"]) {
      map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
    }

    const initial = params.get("loc");
    const target = initial ? list.find((p) => p.loc === initial) : null;
    if (target) map.jumpTo({ center: [target.lng, target.lat], zoom: 14 });
    else fitTo(map, list, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, list]);

  // Highlight + reset paging on selection
  useEffect(() => {
    setShown(PAGE);
    if (map?.getLayer("selected")) map.setFilter("selected", ["==", ["get", "loc"], selected ?? ""]);
  }, [map, selected]);

  return (
    <div className="mapwrap">
      <div ref={ref} className="map" />
      {loading && !checkins.length && <div className="overlay-loading"><Loading /></div>}
      <div className="overlay statbar">
        <Stat n={s.checkins} label="check-ins" />
        <Stat n={list.length} label={mode === "private" ? "venues" : "places"} />
        <Stat n={s.cities} label="cities" />
        <Stat n={s.countries} label="countries" />
        <span className="modepill">{mode === "private" ? "🔓 exact venues" : "🔒 city level"}</span>
      </div>
      {place && (
        <aside className="overlay panel">
          <div className="panel-head">
            <div>
              <h2>{place.name}</h2>
              <p className="muted">
                {mode === "private" && place.where !== place.name && <>{place.where} · </>}
                {place.checkins.length} check-in{place.checkins.length === 1 ? "" : "s"}
              </p>
            </div>
            <button className="x" onClick={() => setSelected(null)} aria-label="Close">
              ×
            </button>
          </div>
          <div className="panel-list">
            {place.checkins.slice(0, shown).map((c) => (
              <CheckinCard key={c.id} c={c} />
            ))}
            {shown < place.checkins.length && (
              <button className="btn ghost" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({place.checkins.length - shown})
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="stat">
      <b>{n.toLocaleString()}</b>
      <span>{label}</span>
    </div>
  );
}
