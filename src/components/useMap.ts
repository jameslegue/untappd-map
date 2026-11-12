"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import worker from "../../.generated/maplibre-worker.json";

// MapLibre 6 loads its worker relative to its own module URL, which Next's
// bundling breaks. Serve the worker as a static file instead (copied there by
// scripts/build-maplibre.mjs on install/build, compiled down as a classic
// worker so older Safari can run it).
maplibregl.setWorkerUrl(worker.url);

export const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#11151a" } }],
};

// Creates a MapLibre map in the ref'd div; returns it once the style has loaded.
// `lost` is true when the browser couldn't start or keep the map's WebGL context.
export function useMap(opts: Partial<maplibregl.MapOptions> = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const m = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE,
      center: [-50, 35],
      zoom: 1.8,
      attributionControl: { compact: true },
      // Safari 26 hands back an already-lost WebGL context when asked for the
      // "high-performance" GPU (MapLibre's default) - the map is blank from the
      // first frame. The default profile works. maplibre/maplibre-gl-js#8195
      canvasContextAttributes: { powerPreference: "default" },
      ...opts,
    });
    // If the context goes anyway, say so instead of showing a silent blank map.
    // No automatic rebuild: retry loops can wedge Safari's GPU process
    m.on("webglcontextlost", () => setLost(true));
    m.on("error", (e) => {
      if (/worker failed to load/i.test(String(e.error?.message ?? ""))) setLost(true);
    });
    m.on("webglcontextrestored", () => setLost(false));
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    let ready = false;
    m.on("load", () => {
      ready = true;
      setMap(m);
    });
    // If the basemap style can't be fetched, fall back to a plain background
    // so the data layers still render
    m.on("error", () => {
      if (!ready && !m.isStyleLoaded()) m.setStyle(FALLBACK_STYLE);
    });
    return () => {
      m.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, map, lost };
}

export function fitTo(map: maplibregl.Map, pts: { lat: number; lng: number }[], maxZoom = 12) {
  if (!pts.length) return;
  const b = new maplibregl.LngLatBounds();
  for (const p of pts) b.extend([p.lng, p.lat]);
  map.fitBounds(b, { padding: 60, maxZoom, duration: 0 });
}
