"use client";

import { useState } from "react";

// Sequential amber ramp for the dark surface: dim (few) -> bright (many).
// Step 0 is "none" and uses the panel colour so empty days recede.
export const RAMP = ["#232a33", "#5a3e14", "#8a5c17", "#c2801b", "#f5a524", "#ffd27a"];

export function rampStep(n: number, breaks: number[]) {
  if (n <= 0) return 0;
  let i = 1;
  while (i < breaks.length && n >= breaks[i]) i++;
  return Math.min(i, RAMP.length - 1);
}

export function Legend({ breaks, unit }: { breaks: number[]; unit: string }) {
  return (
    <div className="ramp-legend" aria-hidden>
      <span>Fewer</span>
      {RAMP.map((c, i) => (
        <i key={c} style={{ background: c }} title={i === 0 ? `No ${unit}` : `${breaks[i - 1] ?? ""}+ ${unit}`} />
      ))}
      <span>More</span>
    </div>
  );
}

// Floating tooltip that follows the pointer within a relatively positioned parent
export type Tip = { x: number; y: number; content: React.ReactNode } | null;

export function TipBox({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="tip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  );
}

export function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const show = (e: React.MouseEvent, content: React.ReactNode) => {
    const host = (e.currentTarget as Element).closest(".tiphost") as HTMLElement | null;
    if (!host) return;
    const r = host.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, content });
  };
  return { tip, show, hide: () => setTip(null) };
}

// Single-series column chart (one hue, no legend - the title names it)
export function Bars({
  data,
  label,
  valueLabel,
}: {
  data: { key: string; value: number }[];
  label: (k: string) => string;
  valueLabel: (v: number) => string;
}) {
  const { tip, show, hide } = useTip();
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 1000, H = 160, pad = 18, gap = 2;
  const bw = (W - gap * (data.length - 1)) / data.length;
  return (
    <div className="tiphost chart">
      <svg viewBox={`0 0 ${W} ${H + pad}`} role="img" aria-label="Check-ins per month">
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" />
        {data.map((d, i) => {
          const h = (d.value / max) * (H - 8);
          const x = i * (bw + gap);
          return (
            <g key={d.key}>
              {/* hit target is the full column, larger than the bar */}
              <rect
                x={x}
                y={0}
                width={bw}
                height={H}
                fill="transparent"
                onMouseMove={(e) => show(e, <><b>{label(d.key)}</b><br />{valueLabel(d.value)}</>)}
                onMouseLeave={hide}
              />
              {d.value > 0 && (
                <path
                  d={roundedTop(x + bw * 0.12, H - h, bw * 0.76, h, Math.min(4, h))}
                  fill="var(--amber)"
                  pointerEvents="none"
                />
              )}
              <text x={x + bw / 2} y={H + 13} textAnchor="middle" className="axis">
                {label(d.key).slice(0, 1)}
              </text>
            </g>
          );
        })}
      </svg>
      <TipBox tip={tip} />
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}
