"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BAND_COLOR, BAND_LABEL, bandFor, type Band } from "@/lib/graph";
import { applyFilter, isFiltered, toggleFacet, type Filter } from "@/lib/filters";
import type { Reaction } from "@/lib/types";
import { ScoreChip } from "./Viz";

type Props = {
  reactions: Reaction[];
  segments: { id: string; label: string }[];
  clusters: string[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const BANDS: Band[] = ["strong", "mixed", "weak"];

function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "border-transparent text-white"
          : "border-line-2 bg-paper text-ink-2 hover:border-line hover:text-ink-1"
      }`}
      style={active ? { background: color ?? "#1d1d1f" } : undefined}
    >
      {children}
    </button>
  );
}

export default function ReactionFeed({
  reactions,
  segments,
  clusters,
  filter,
  onFilter,
  selectedId,
  onSelect,
}: Props) {
  const [criticalFirst, setCriticalFirst] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const segmentLabel = useMemo(
    () => new Map(segments.map((s) => [s.id, s.label])),
    [segments],
  );

  const visible = useMemo(() => {
    const list = applyFilter(reactions, filter);
    return [...list].sort((a, b) =>
      criticalFirst ? a.score - b.score : b.score - a.score,
    );
  }, [reactions, filter, criticalFirst]);

  // when a node is picked in the constellation, bring its card into view
  useEffect(() => {
    if (!selectedId) return;
    rowRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId, visible]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-1.5">
          {segments.map((s) => (
            <Chip
              key={s.id}
              active={filter.segment === s.id}
              onClick={() => onFilter(toggleFacet(filter, "segment", s.id))}
            >
              {s.label}
            </Chip>
          ))}
        </div>
        <span className="h-4 w-px bg-line-2" aria-hidden="true" />
        <div className="flex flex-wrap gap-1.5">
          {BANDS.map((b) => (
            <Chip
              key={b}
              active={filter.band === b}
              color={BAND_COLOR[b]}
              onClick={() => onFilter(toggleFacet(filter, "band", b))}
            >
              {BAND_LABEL[b]}
            </Chip>
          ))}
        </div>
        {clusters.length > 0 && (
          <>
            <span className="h-4 w-px bg-line-2" aria-hidden="true" />
            <div className="flex flex-wrap gap-1.5">
              {clusters.map((c) => (
                <Chip
                  key={c}
                  active={filter.cluster === c}
                  color="#c2650a"
                  onClick={() => onFilter(toggleFacet(filter, "cluster", c))}
                >
                  {c}
                </Chip>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-b border-line-2 pb-2.5">
        <span className="text-[12px] text-ink-2">
          <span className="font-mono">{visible.length}</span>
          {isFiltered(filter) && (
            <span className="text-ink-3"> of {reactions.length}</span>
          )}{" "}
          {visible.length === 1 ? "reaction" : "reactions"}
          {isFiltered(filter) && (
            <button
              type="button"
              onClick={() => onFilter({ segment: null, band: null, cluster: null })}
              className="ml-2 text-blue-1 hover:underline"
            >
              Clear
            </button>
          )}
        </span>
        <button
          type="button"
          onClick={() => setCriticalFirst((v) => !v)}
          className="text-[12px] text-ink-2 hover:text-ink-1"
        >
          {criticalFirst ? "Most critical first" : "Best reception first"} ↕
        </button>
      </div>

      <div className="no-scrollbar mt-1 max-h-[560px] overflow-y-auto">
        {visible.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-ink-3">
            No follower matches this combination.
          </p>
        ) : (
          <ul className="divide-y divide-line-2">
            {visible.map((r) => {
              const active = selectedId === r.followerId;
              return (
                <li key={r.followerId}>
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) rowRefs.current.set(r.followerId, el);
                      else rowRefs.current.delete(r.followerId);
                    }}
                    onClick={() => onSelect(active ? null : r.followerId)}
                    className={`fade-up flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${
                      active ? "bg-blue-1/[0.06]" : "hover:bg-mist/70"
                    }`}
                  >
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        background: `${BAND_COLOR[bandFor(r.score)]}1f`,
                        color: BAND_COLOR[bandFor(r.score)],
                      }}
                      aria-hidden="true"
                    >
                      {r.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[13px] font-semibold">{r.name}</span>
                        <span className="font-mono text-[11px] text-ink-3">{r.handle}</span>
                        <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] text-ink-2">
                          {segmentLabel.get(r.segment) ?? r.segment}
                        </span>
                      </span>
                      <span className="mt-1 block text-[13px] leading-snug text-ink-1">
                        {r.comment}
                      </span>
                      {r.objection && (
                        <span className="mt-1.5 block text-[12px] leading-snug text-orange-1">
                          {r.objection}
                        </span>
                      )}
                    </span>
                    <ScoreChip score={r.score} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
