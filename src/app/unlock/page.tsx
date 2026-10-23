"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/DataProvider";

export default function UnlockPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { reload } = useData();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      await reload();
      router.push("/");
    } else {
      setErr("Wrong password.");
      setBusy(false);
    }
  }

  return (
    <div className="scroll">
      <form className="formpage" onSubmit={submit}>
        <h1>Unlock</h1>
        <p className="muted">Exact venues, photos and notes are behind a password.</p>
        <input
          className="input"
          type="password"
          autoFocus
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        {err && <p className="err">{err}</p>}
        <p>
          <button className="btn" disabled={busy || !pw}>
            {busy ? "Checking…" : "Unlock"}
          </button>
        </p>
      </form>
    </div>
  );
}
