"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useData } from "./DataProvider";

const LINKS = [
  { href: "/", label: "Map" },
  { href: "/passport", label: "Passport" },
  { href: "/replay", label: "Replay" },
  { href: "/mosaic", label: "Mosaic", locked: true },
  { href: "/wall", label: "Wall", locked: true },
  { href: "/stats", label: "Stats" },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { mode, reload } = useData();
  const unlocked = mode === "private";
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => path === href || (href !== "/" && path.startsWith(`${href}/`));

  // Close the phone menu on navigation and on Escape
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function lock() {
    setOpen(false);
    await fetch("/api/logout", { method: "POST" });
    await reload();
    router.push("/");
  }

  const current = LINKS.find((l) => isActive(l.href))?.label ?? (path === "/admin" ? "Admin" : "");

  return (
    <header className="nav">
      <Link href="/" className="brand">
        <span aria-hidden>🍺</span> <span className="brand-text">jimmylegs.beer</span>
      </Link>
      <nav className="links">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
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

      {/* Phones: current page + menu button instead of the link row */}
      <span className="nav-current">{current}</span>
      <button
        className="menu-btn"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span>
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <nav id="mobile-menu" className="menu">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
                {l.label}
                {l.locked && !unlocked && <span className="lockdot" aria-label="locked"> 🔒</span>}
              </Link>
            ))}
            <div className="menu-sep" />
            {unlocked ? (
              <>
                <Link href="/admin" className={path === "/admin" ? "active" : ""}>Admin</Link>
                <button onClick={lock}>Lock</button>
              </>
            ) : (
              <Link href="/unlock" className="menu-unlock">Unlock</Link>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
