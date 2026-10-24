"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/components/DataProvider";

const TABS = [
  { href: "/stats/review", label: "Year in review" },
  { href: "/stats/trips", label: "Trips", locked: true },
  { href: "/stats/hot-takes", label: "Hot takes" },
  { href: "/stats/calendar", label: "Calendar" },
  { href: "/stats/streaks", label: "Streaks" },
];

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { mode } = useData();
  return (
    <div className="scroll">
      <div className="statspage">
        <nav className="tabs">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={path === t.href ? "on" : ""}>
              {t.label}
              {t.locked && mode !== "private" && <span className="lockdot" aria-label="locked"> 🔒</span>}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
