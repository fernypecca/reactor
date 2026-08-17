"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Graph, GraphNode } from "@/lib/graph";
import type { Reaction } from "@/lib/types";

/**
 * What to paint on a node. The graph itself is dumb: the page decides whether
 * a node is coloured by engagement score or by A-vs-B delta.
 */
export type NodeDatum = {
  color: string;
  /** 0..1 — drives the size of the solid core inside the node */
  intensity: number;
  reaction?: Reaction;
  /** extra line in the tooltip, e.g. "+18 vs A" */
  note?: string;
};

type Props = {
  graph: Graph;
  data: Map<string, NodeDatum>;
  /** null = show everything; a set = dim everything outside it */
  highlight?: Set<string> | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  className?: string;
};

type Hover = { node: GraphNode; x: number; y: number };

const IDLE_FILL = "#f2f2f5";
const IDLE_STROKE = "#dcdce1";
const EDGE = "rgba(29, 29, 31, 0.055)";
const EDGE_LIVE = "rgba(29, 29, 31, 0.11)";
const RING_MS = 850;
const POP_MS = 520;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** ease-out-back, for the little pop when a clone reacts */
function easeOutBack(t: number): number {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export default function AudienceGraph({
  graph,
  data,
  highlight = null,
  selectedId = null,
  onSelect,
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // mutable render state, kept out of React so the rAF loop never re-renders
  const arrivals = useRef(new Map<string, number>());
  const layout = useRef(new Map<string, { px: number; py: number; pr: number }>());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const reduced = useRef(false);

  // the rAF loop reads the latest props without being torn down on every change
  const stateRef = useRef({ graph, data, highlight, selectedId });
  useEffect(() => {
    stateRef.current = { graph, data, highlight, selectedId };
  }, [graph, data, highlight, selectedId]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onChange = () => {
      reduced.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // stamp the arrival time of each new datum so it can animate in
  useEffect(() => {
    const now = performance.now();
    for (const id of data.keys()) {
      if (!arrivals.current.has(id)) arrivals.current.set(id, now);
    }
    for (const id of [...arrivals.current.keys()]) {
      if (!data.has(id)) arrivals.current.delete(id);
    }
  }, [data]);

  // a new audience means a fresh field
  useEffect(() => {
    arrivals.current.clear();
    layout.current.clear();
  }, [graph]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;

    let frame = 0;

    const draw = (t: number) => {
      const { graph: g, data: d, highlight: hl, selectedId: sel } = stateRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);

      const pad = 26;
      const innerW = size.w - pad * 2;
      const innerH = size.h - pad * 2;
      const baseR = Math.max(6.5, Math.min(Math.min(size.w, size.h) * 0.032, 15));

      const px = (n: GraphNode) => pad + n.x * innerW;
      const py = (n: GraphNode) => pad + n.y * innerH;

      // ---- edges ----
      const nodeAlpha = (n: GraphNode) => (hl && !hl.has(n.id) ? 0.14 : 1);
      ctx.lineWidth = 1;
      for (const e of g.edges) {
        const a = g.nodes[e.a];
        const b = g.nodes[e.b];
        const alpha = Math.min(nodeAlpha(a), nodeAlpha(b));
        if (alpha < 0.2) {
          ctx.strokeStyle = "rgba(29,29,31,0.02)";
        } else {
          const da = d.get(a.id);
          const db = d.get(b.id);
          if (da && db) {
            ctx.strokeStyle = rgba(da.intensity >= db.intensity ? da.color : db.color, 0.16);
          } else {
            ctx.strokeStyle = da || db ? EDGE_LIVE : EDGE;
          }
        }
        ctx.beginPath();
        ctx.moveTo(px(a), py(a));
        ctx.lineTo(px(b), py(b));
        ctx.stroke();
      }

      // ---- nodes ----
      layout.current.clear();
      for (const n of g.nodes) {
        const x = px(n);
        const y = py(n);
        const datum = d.get(n.id);
        const born = arrivals.current.get(n.id);
        const age = born === undefined ? Infinity : t - born;

        // gentle breathing so the field feels alive without demanding attention
        const breathe = reduced.current
          ? 1
          : 1 + Math.sin(t / 1700 + n.index * 0.9) * 0.028;

        let pop = 1;
        if (!reduced.current && age < POP_MS) {
          pop = 0.55 + easeOutBack(age / POP_MS) * 0.45;
        }

        const r = baseR * n.r * breathe * pop;
        layout.current.set(n.id, { px: x, py: y, pr: r });

        const alpha = nodeAlpha(n);
        ctx.globalAlpha = alpha;

        // arrival ring
        if (!reduced.current && age < RING_MS && alpha > 0.5) {
          const p = age / RING_MS;
          ctx.beginPath();
          ctx.arc(x, y, r + p * r * 2.4, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(datum?.color ?? "#0071e3", 0.42 * (1 - p));
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        if (datum) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = rgba(datum.color, 0.15);
          ctx.fill();
          ctx.strokeStyle = rgba(datum.color, 0.85);
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // solid core scaled by intensity — reads as strength at a glance
          const core = r * (0.26 + Math.max(0, Math.min(1, datum.intensity)) * 0.36);
          if (core > 0.5) {
            ctx.beginPath();
            ctx.arc(x, y, core, 0, Math.PI * 2);
            ctx.fillStyle = datum.color;
            ctx.fill();
          }
        } else {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = IDLE_FILL;
          ctx.fill();
          ctx.strokeStyle = IDLE_STROKE;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (sel === n.id) {
          ctx.beginPath();
          ctx.arc(x, y, r + 5.5, 0, Math.PI * 2);
          ctx.strokeStyle = "#0071e3";
          ctx.lineWidth = 1.75;
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
      }

      // ---- cluster labels, drawn last so their chips sit above the nodes ----
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const c of g.clusters) {
        const members = g.nodes.filter((n) => n.segment === c.id);
        if (members.length === 0) continue;
        const topY = Math.min(...members.map(py));
        const cx = pad + c.x * innerW;
        const dimmed = hl ? !members.some((m) => hl.has(m.id)) : false;
        ctx.font = "600 10px ui-sans-serif, -apple-system, system-ui, sans-serif";
        const text = `${c.label.toUpperCase()}  ·  ${c.count}`;
        const cy = Math.max(12, topY - baseR * 1.9);

        // a chip behind the label: on narrow screens the clusters compress and
        // a bare label ends up sitting on top of a node
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = dimmed ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.88)";
        ctx.beginPath();
        ctx.roundRect(cx - tw / 2 - 5, cy - 8, tw + 10, 16, 8);
        ctx.fill();

        ctx.fillStyle = dimmed ? "rgba(134,134,139,0.28)" : "rgba(134,134,139,0.92)";
        ctx.fillText(text, cx, cy);
      }

      // ---- hover hit-test against the coordinates we just drew ----
      const p = pointer.current;
      if (p) {
        let found: GraphNode | null = null;
        let bestD = Infinity;
        for (const n of g.nodes) {
          const l = layout.current.get(n.id);
          if (!l) continue;
          if (hl && !hl.has(n.id)) continue;
          const dist = Math.hypot(p.x - l.px, p.y - l.py);
          if (dist <= l.pr + 5 && dist < bestD) {
            bestD = dist;
            found = n;
          }
        }
        setHover((prev) => {
          if (!found) return prev === null ? prev : null;
          if (prev && prev.node.id === found.id) return prev;
          const l = layout.current.get(found.id)!;
          return { node: found, x: l.px, y: l.py };
        });
        canvas.style.cursor = found ? "pointer" : "default";
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onLeave = useCallback(() => {
    pointer.current = null;
    setHover(null);
  }, []);

  // swapping audiences can leave a hover pointing at a node that no longer
  // exists — drop it at render time rather than reaching for setState
  const nodeIds = useMemo(() => new Set(graph.nodes.map((n) => n.id)), [graph]);
  const active = hover && nodeIds.has(hover.node.id) ? hover : null;

  const onClick = useCallback(() => {
    if (!onSelect) return;
    onSelect(active ? (selectedId === active.node.id ? null : active.node.id) : null);
  }, [active, onSelect, selectedId]);

  const hoverDatum = active ? data.get(active.node.id) : undefined;
  const tipRight = active ? active.x > size.w * 0.55 : false;
  const tipBelow = active ? active.y < 150 : false;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onClick}
        role="img"
        aria-label={`Audience field: ${graph.nodes.length} simulated followers across ${graph.clusters.length} segments, ${data.size} have reacted`}
      />

      {active && (
        <div
          className="pointer-events-none absolute z-20 w-64 rounded-2xl border border-line-2 bg-paper/95 p-3.5 backdrop-blur"
          style={{
            left: tipRight ? active.x - 268 : active.x + 16,
            top: tipBelow ? active.y + 18 : active.y - 18,
            transform: tipBelow ? "none" : "translateY(-100%)",
            boxShadow: "0 16px 40px -18px rgba(0,0,0,0.32)",
          }}
        >
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">{active.node.profile.name}</span>
            <span className="truncate font-mono text-[11px] text-ink-3">
              {active.node.profile.handle}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-ink-2">{active.node.profile.bio}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {active.node.profile.interests.map((i) => (
              <span key={i} className="rounded-full bg-mist px-2 py-0.5 text-[10px] text-ink-2">
                {i}
              </span>
            ))}
          </div>
          {hoverDatum?.reaction ? (
            <div className="mt-2.5 border-t border-line-2 pt-2.5">
              <div className="flex items-baseline gap-2">
                <span className="numeral text-lg" style={{ color: hoverDatum.color }}>
                  {hoverDatum.reaction.score}
                </span>
                <span className="text-[11px] text-ink-3">engagement score</span>
                {hoverDatum.note && (
                  <span
                    className="ml-auto font-mono text-[11px] font-semibold"
                    style={{ color: hoverDatum.color }}
                  >
                    {hoverDatum.note}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] leading-snug text-ink-1">
                &ldquo;{hoverDatum.reaction.comment}&rdquo;
              </p>
              {hoverDatum.reaction.objection && (
                <p className="mt-1.5 text-[11px] leading-snug text-orange-1">
                  {hoverDatum.reaction.objection}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2.5 border-t border-line-2 pt-2.5 text-[11px] text-ink-3">
              {hoverDatum?.note ?? "Hasn't reacted yet"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
