"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { Locked } from "@/components/bits";
import { stats } from "@/lib/group";

const CHUNK = 750;

export default function AdminPage() {
  const { mode, checkins, reload } = useData();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (mode !== "private") return <Locked what="Admin" />;

  async function syncNow() {
    setBusy(true);
    setLog(["Checking the Untappd RSS feed…"]);
    const res = await fetch("/api/sync", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setLog([
        `Feed had ${body.fetched} check-ins, ${body.added} new.` +
          (body.unplaced ? ` ${body.unplaced} at venues not seen before - they'll be placed by the next export upload.` : "") +
          (body.skipped ? ` ${body.skipped} couldn't be parsed.` : ""),
      ]);
      await reload();
    } else {
      setLog([`Sync failed: ${body.error ?? res.status}`]);
    }
    setBusy(false);
  }
  const s = stats(checkins);
  const latest = checkins.at(-1)?.t;

  async function upload(file: File) {
    setBusy(true);
    setLog([`Reading ${file.name}…`]);
    try {
      const rows = JSON.parse(await file.text());
      if (!Array.isArray(rows)) throw new Error("Expected the Untappd JSON export (an array of check-ins).");
      let saved = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: rows.slice(i, i + CHUNK) }),
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
        saved += (await res.json()).saved;
        setLog((l) => [...l.slice(0, 1), `Saved ${saved.toLocaleString()} / ${rows.length.toLocaleString()}`]);
      }
      await reload();
      setLog((l) => [...l, "Done."]);
    } catch (e) {
      setLog((l) => [...l, `Error: ${(e as Error).message}`]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scroll">
      <div className="formpage">
        <h1>Admin</h1>
        <p className="muted">
          {s.checkins.toLocaleString()} check-ins loaded
          {latest && <> · latest {new Date(latest).toLocaleDateString()}</>}
        </p>
        <h3>Hourly sync</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          New check-ins are pulled from your Untappd RSS feed every hour. Venues already on the map are placed
          automatically; brand-new ones get coordinates from the next export upload.
        </p>
        <button className="btn" onClick={syncNow} disabled={busy}>
          Sync now
        </button>
        <h3>Upload an Untappd export</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          Untappd → Account → Download History → JSON. Re-uploading is safe - check-ins are matched by ID, and the export
          fills in details the RSS feed doesn&apos;t have (ratings, styles, new venues).
        </p>
        <input
          className="input"
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <div style={{ marginTop: 16, fontSize: 14 }}>
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
