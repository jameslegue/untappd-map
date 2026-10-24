"use client";

import { useMemo, useState } from "react";

export type Column<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null;
  render?: (row: T) => React.ReactNode;
  num?: boolean; // right-aligned, sorts descending first
  hideMobile?: boolean;
};

const PAGE = 200;

// Click a header to sort by it; click again to flip direction. Nulls always sink.
export function SortTable<T>({
  rows,
  columns,
  initial,
  rowKey,
  onRow,
}: {
  rows: T[];
  columns: Column<T>[];
  initial: { key: string; desc: boolean };
  rowKey: (row: T) => string | number;
  onRow?: (row: T) => void;
}) {
  const [sort, setSort] = useState(initial);
  const [shown, setShown] = useState(PAGE);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key) ?? columns[0];
    const dir = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const x = col.value(a), y = col.value(b);
      if (x == null || x === "") return y == null || y === "" ? 0 : 1;
      if (y == null || y === "") return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y), undefined, { sensitivity: "base" }) * dir;
    });
  }, [rows, columns, sort]);

  function by(c: Column<T>) {
    setShown(PAGE);
    setSort((s) => (s.key === c.key ? { key: c.key, desc: !s.desc } : { key: c.key, desc: !!c.num }));
  }

  return (
    <>
      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.num ? "num" : ""} ${c.hideMobile ? "hm" : ""}`}
                  aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"}
                >
                  <button onClick={() => by(c)}>
                    {c.label}
                    <span className="arrow">{sort.key === c.key ? (sort.desc ? "▼" : "▲") : ""}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, shown).map((r) => (
              <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} className={onRow ? "click" : ""}>
                {columns.map((c) => (
                  <td key={c.key} className={`${c.num ? "num" : ""} ${c.hideMobile ? "hm" : ""}`}>
                    {c.render ? c.render(r) : c.value(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown < sorted.length && (
        <p style={{ textAlign: "center" }}>
          <button className="btn ghost" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({(sorted.length - shown).toLocaleString()} left)
          </button>
        </p>
      )}
    </>
  );
}
