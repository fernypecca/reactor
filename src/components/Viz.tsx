"use client";

import { useEffect, useRef, useState } from "react";
import { BAND_COLOR, BAND_LABEL, bandFor, type Band } from "@/lib/graph";

export const VARIANT_COLOR: Record<string, string> = {
  "variant-1": "#0071e3",
  "variant-2": "#af52de",
};

export const variantLetter = (id: string) => (id === "variant-2" ? "B" : "A");

/** Tolerates the fractional values a count-up tween passes through. */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return Math.round(n).toLocaleString("en-US");
}

/** Cumulative average after each reaction — the shape of the room turning. */
export function runningAvg(scores: number[]): number[] {
  const out: number[] = [];
  let sum = 0;
  scores.forEach((s, i) => {
    sum += s;
    out.push(sum / (i + 1));
  });
  return out;
}

/**
 * Score trajectory. Y axis is pinned to 0–100 with the band thresholds drawn in,
 * so two runs are always visually comparable — no auto-scaling illusions.
 */
export function Sparkline({
  series,
  height = 92,
  total,
}: {
  series: {
    id: string;
    color: string;
    /** running average — the line */
    points: number[];
    /** individual scores — the ticks, so the spread is visible too */
    raw?: number[];
  }[];
  height?: number;
  /** expected number of reactions per series, so a partial run reads as partial */
  total: number;
}) {
  const W = 600;
  const H = height;
  const denom = Math.max(total - 1, 1);
  const x = (i: number) => (i / denom) * W;
  const y = (v: number) => H - (v / 100) * H;

  const path = (pts: number[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p).toFixed(2)}`).join(" ");

  const hasData = series.some((s) => s.points.length > 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden="true"
    >
      {[40, 70].map((t) => (
        <line
          key={t}
          x1={0}
          x2={W}
          y1={y(t)}
          y2={y(t)}
          stroke="#e8e8ed"
          strokeWidth={1}
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {hasData &&
        series.map((s) =>
          s.points.length === 0 ? null : (
            <g key={s.id}>
              {s.raw?.map((v, i) => (
                <line
                  key={i}
                  x1={x(i)}
                  x2={x(i)}
                  y1={y(v) - 2.5}
                  y2={y(v) + 2.5}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  opacity={0.28}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path
                d={`${path(s.points)} L${x(s.points.length - 1)},${H} L0,${H} Z`}
                fill={s.color}
                opacity={0.07}
              />
              <path
                d={path(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={x(s.points.length - 1)}
                cy={y(s.points[s.points.length - 1])}
                r={3.5}
                fill={s.color}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ),
        )}
    </svg>
  );
}

/** Horizontal grouped bars — one row per segment, one bar per variant. */
export function SegmentBars({
  segments,
  rows,
  onHover,
  activeSegment,
}: {
  segments: { id: string; label: string }[];
  rows: { variantId: string; scores: Map<string, number> }[];
  onHover?: (segmentId: string | null) => void;
  activeSegment?: string | null;
}) {
  return (
    <div className="space-y-3.5">
      {segments.map((seg) => (
        <button
          key={seg.id}
          type="button"
          onMouseEnter={() => onHover?.(seg.id)}
          onMouseLeave={() => onHover?.(null)}
          onFocus={() => onHover?.(seg.id)}
          onBlur={() => onHover?.(null)}
          className={`block w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
            activeSegment === seg.id ? "bg-mist" : "hover:bg-mist/60"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium">{seg.label}</span>
            <span className="font-mono text-[11px] text-ink-3">
              {rows
                .map((r) => {
                  const v = r.scores.get(seg.id);
                  return v === undefined ? "—" : v.toFixed(1);
                })
                .join("  /  ")}
            </span>
          </div>
          <div className="mt-1.5 space-y-1">
            {rows.map((r) => {
              const v = r.scores.get(seg.id) ?? 0;
              return (
                <div key={r.variantId} className="h-1.5 rounded-full bg-mist-2">
                  <div
                    className="bar-fill h-1.5 rounded-full"
                    style={{
                      width: `${Math.max(v, 1)}%`,
                      background: VARIANT_COLOR[r.variantId] ?? "#0071e3",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </button>
      ))}
    </div>
  );
}

export function BandLegend({ counts }: { counts?: Record<Band, number> }) {
  const bands: Band[] = ["strong", "mixed", "weak"];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {bands.map((b) => (
        <span key={b} className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: BAND_COLOR[b] }}
            aria-hidden="true"
          />
          {BAND_LABEL[b]}
          {counts && <span className="font-mono text-ink-3">{counts[b]}</span>}
        </span>
      ))}
    </div>
  );
}

export function ScoreChip({ score }: { score: number }) {
  const color = BAND_COLOR[bandFor(score)];
  return (
    <span
      className="numeral shrink-0 rounded-full px-2.5 py-1 text-[13px]"
      style={{ color, background: `${color}1a` }}
    >
      {score}
    </span>
  );
}


/**
 * Eases a number toward its target so a counter reads as climbing rather than
 * jumping. Every setState happens inside the rAF callback, never in the
 * effect body.
 */
export function useCountUp(target: number, animate = true): number {
  const [display, setDisplay] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const diff = target - current.current;
      if (!animate || Math.abs(diff) < 0.6) {
        current.current = target;
        setDisplay(target);
        return;
      }
      current.current += diff * 0.16;
      setDisplay(current.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, animate]);

  return display;
}

export function AnimatedNumber({
  value,
  animate = true,
  format = (n: number) => Math.round(n).toLocaleString("en-US"),
  className,
  style,
}: {
  value: number;
  animate?: boolean;
  format?: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const shown = useCountUp(value, animate);
  return (
    <span className={className} style={style}>
      {format(shown)}
    </span>
  );
}
