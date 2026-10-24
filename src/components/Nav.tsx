"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useData } from "./DataProvider";

const LINKS = [
  { href: "/", label: "Map" },
  { href: "/passport", label: "Passport" },
  { href: "/replay", label: "Replay" },
  { href: "/mosaic", label: "Mosaic", locked: true },
  { href: "/wall", label: "Wall", locked: true },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { mode, reload } = useData();
  const unlocked = mode === "private";

  async function lock() {
    await fetch("/api/logout", { method: "POST" });
    await reload();
    router.push("/");
  }

  return (
    <header className="nav">
      <Link href="/" className="brand">
        <span aria-hidden>🍺</span> <span className="brand-text">jimmylegs.beer</span>
      </Link>
      <nav className="links">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
            {l.label}
            {l.locked && !unlocked && <span className="lockdot" aria-label="locked"> 🔒</span>}
          </Link>
        ))}
      </nav>
      <div className="right">
        {unlocked ? (
          <>
            <Link href="/admin" className={path === "/admin" ? "active" : ""}>Admin</Link>
            <button onClick={lock} className="btn ghost">Lock</button>
          </>
        ) : (
          <Link href="/unlock" className="btn">Unlock</Link>
        )}
      </div>
    </header>
  );
}
