"use client";

import { useState } from "react";
import type { Filter } from "@/lib/filters";
import { toggleFacet } from "@/lib/filters";
import type { RewriteResult, SimulationResult, VariantResult } from "@/lib/types";
import { verdictFor } from "@/lib/verdict";
import { SegmentBars, VARIANT_COLOR, variantLetter } from "./Viz";

type Props = {
  result: SimulationResult;
  segments: { id: string; label: string }[];
  viewed: VariantResult;
  rewrite?: RewriteResult;
  filter: Filter;
  onFilter: (f: Filter) => void;
  onHoverSegment: (id: string | null) => void;
  activeSegment: string | null;
  onTestRewrite: () => void;
  busy: boolean;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-mist"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
      {children}
    </h3>
  );
}

export default function Results({
  result,
  segments,
  viewed,
  rewrite,
  filter,
  onFilter,
  onHoverSegment,
  activeSegment,
  onTestRewrite,
  busy,
}: Props) {
  const verdict = verdictFor(result.variants, result.bestVariantId);

  const rows = result.variants.map((v) => ({
    variantId: v.variantId,
    scores: new Map(v.segmentScores.map((s) => [s.segment, s.avg])),
  }));

  const maxObjection = Math.max(1, ...viewed.objectionClusters.map((c) => c.count));
  const topObjection = viewed.objectionClusters[0];

  return (
    <div className="space-y-5">
      {verdict && (
        <div className="card fade-up p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionTitle>Verdict</SectionTitle>
              <p className="display mt-2 text-2xl text-balance">
                {!verdict.runnerUp ? (
                  <>
                    Your audience scores this{" "}
                    <span style={{ color: VARIANT_COLOR[verdict.best.variantId] }}>
                      {verdict.best.avgScore}
                    </span>{" "}
                    out of 100.
                  </>
                ) : verdict.decisive ? (
                  <>
                    Variant {variantLetter(verdict.best.variantId)} wins by{" "}
                    <span style={{ color: VARIANT_COLOR[verdict.best.variantId] }}>
                      {verdict.margin}
                    </span>{" "}
                    points.
                  </>
                ) : (
                  <>Too close to call.</>
                )}
              </p>
              {verdict.runnerUp && !verdict.decisive && (
                <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-ink-2">
                  A and B land {verdict.margin} points apart across{" "}
                  {verdict.best.reactions.length} clones — inside the noise. Neither angle is
                  actually working harder. Push one further instead of picking.
                </p>
              )}
            </div>
            <CopyButton text={verdict.best.copy} />
          </div>
          <p className="mt-4 border-l-2 border-line-2 pl-4 text-[14px] leading-relaxed text-ink-2">
            {verdict.best.copy}
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <SectionTitle>Score by segment</SectionTitle>
          <p className="mt-1.5 mb-4 text-[12px] text-ink-3">
            {result.variants.length > 1
              ? "Blue is A, violet is B. Hover a row to isolate it in the field."
              : "Hover a row to isolate that segment in the field."}
          </p>
          <SegmentBars
            segments={segments}
            rows={rows}
            onHover={onHoverSegment}
            activeSegment={activeSegment}
          />
        </div>

        <div className="card p-6">
          <div className="flex items-baseline justify-between">
            <SectionTitle>What stops them</SectionTitle>
            <span className="font-mono text-[11px] text-ink-3">
              variant {variantLetter(viewed.variantId)}
            </span>
          </div>
          {viewed.objectionClusters.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-2">
              No objection cleared the noise floor. Rare — and a good sign.
            </p>
          ) : (
            <>
              <p className="mt-1.5 mb-4 text-[12px] text-ink-3">
                Click a theme to isolate those followers.
              </p>
              <div className="space-y-2.5">
                {viewed.objectionClusters.map((c) => {
                  const active = filter.cluster === c.objection;
                  return (
                    <button
                      key={c.objection}
                      type="button"
                      onClick={() => onFilter(toggleFacet(filter, "cluster", c.objection))}
                      aria-pressed={active}
                      className={`block w-full rounded-xl px-2.5 py-2 text-left transition-colors ${
                        active ? "bg-orange-1/[0.08]" : "hover:bg-mist/70"
                      }`}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] font-medium capitalize">{c.objection}</span>
                        <span className="font-mono text-[12px] text-ink-2">{c.count}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-mist-2">
                        <div
                          className="bar-fill h-1.5 rounded-full bg-orange-1"
                          style={{ width: `${(c.count / maxObjection) * 100}%` }}
                        />
                      </div>
                      {active && (
                        <ul className="fade-in mt-2 space-y-1">
                          {c.examples.map((e) => (
                            <li key={e} className="text-[12px] leading-snug text-ink-2">
                              &ldquo;{e}&rdquo;
                            </li>
                          ))}
                        </ul>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {rewrite && rewrite.rewrite && rewrite.source === "llm" && (
        <div className="card fade-up border-blue-1/25 bg-blue-1/[0.03] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>Rewrite that answers the top objection</SectionTitle>
            <div className="flex items-center gap-2">
              <CopyButton text={rewrite.rewrite} />
              <button
                type="button"
                onClick={onTestRewrite}
                disabled={busy}
                className="shrink-0 rounded-full bg-blue-1 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
              >
                Test it against the winner
              </button>
            </div>
          </div>
          <p className="mt-4 text-[17px] leading-relaxed">{rewrite.rewrite}</p>
          <p className="mt-3 text-[13px] text-ink-2">{rewrite.why}</p>
        </div>
      )}

      {rewrite?.source === "fallback" && topObjection && (
        <div className="card fade-up p-6">
          <SectionTitle>Fix this before you post</SectionTitle>
          <p className="display mt-2 text-xl">
            <span className="capitalize text-orange-1">{topObjection.objection}</span> is what
            {" "}
            {topObjection.count} of {viewed.reactions.length} followers push back on.
          </p>
          <ul className="mt-4 space-y-1.5">
            {topObjection.examples.map((e) => (
              <li key={e} className="text-[13px] leading-snug text-ink-2">
                &ldquo;{e}&rdquo;
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line-2 pt-3 text-[12px] text-ink-3">
            Add an <code className="font-mono">ANTHROPIC_API_KEY</code> to get a rewritten
            version that answers this objection. Without one, Reactor scores and clusters but
            does not write.
          </p>
        </div>
      )}
    </div>
  );
}
