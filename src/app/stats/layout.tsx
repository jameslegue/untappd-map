"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/stats/review", label: "Year in review" },
  { href: "/stats/trips", label: "Trips" },
  { href: "/stats/hot-takes", label: "Hot takes" },
  { href: "/stats/calendar", label: "Calendar" },
  { href: "/stats/streaks", label: "Streaks" },
];

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="scroll">
      <div className="statspage">
        <nav className="tabs">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={path === t.href ? "on" : ""}>
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
