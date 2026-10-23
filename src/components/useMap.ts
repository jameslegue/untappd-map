"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

export const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#11151a" } }],
};

// Creates a MapLibre map in the ref'd div; returns it once the style has loaded
export function useMap(opts: Partial<maplibregl.MapOptions> = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const m = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE,
      center: [-50, 35],
      zoom: 1.8,
      attributionControl: { compact: true },
      ...opts,
    });
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

  return { ref, map };
}

export function fitTo(map: maplibregl.Map, pts: { lat: number; lng: number }[], maxZoom = 12) {
  if (!pts.length) return;
  const b = new maplibregl.LngLatBounds();
  for (const p of pts) b.extend([p.lng, p.lat]);
  map.fitBounds(b, { padding: 60, maxZoom, duration: 0 });
}
