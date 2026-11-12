"use client";

import Link from "next/link";

// Shown in place of a silent blank map when useMap reports `lost`
export function MapLost() {
  return (
    <div className="overlay map-lost" role="alert">
      <b>The map couldn&apos;t draw</b>
      <p className="muted">
        Your browser couldn&apos;t start or keep the map running - it happens in Safari. Reloading usually fixes it;
        if not, quitting and reopening the browser does.
      </p>
      <p>
        <button className="btn" onClick={() => location.reload()}>Reload map</button>{" "}
        <Link href="/passport" className="btn ghost">Passport</Link>{" "}
        <Link href="/stats" className="btn ghost">Stats</Link>
      </p>
    </div>
  );
}
