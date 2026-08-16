"use client";

import { useMemo, useState } from "react";
import { AUDIENCES } from "@/lib/audiences";
import { postJson, readNdjson } from "@/lib/client-utils";
import { engagementFromReaction, sumEngagement } from "@/lib/engagement";
import type {
  Audience,
  Reaction,
  SimulationResult,
} from "@/lib/types";

type Step = "audience" | "copy" | "simulate" | "results";

type SimState = {
  streaming: boolean;
  variantA: Reaction[];
  variantB: Reaction[];
  result?: SimulationResult;
  rewrite?: { rewrite: string; why: string };
  error?: string;
  stageLabel: string;
};

const IDLE: SimState = {
  streaming: false,
  variantA: [],
  variantB: [],
  stageLabel: "",
};

export default function Home() {
  const [step, setStep] = useState<Step>("audience");
  const [audience, setAudience] = useState<Audience | null>(null);
  const [copyA, setCopyA] = useState("");
  const [copyB, setCopyB] = useState("");
  const [useB, setUseB] = useState(false);
  const [generatingB, setGeneratingB] = useState(false);
  const [bAngle, setBAngle] = useState("");
  const [bError, setBError] = useState("");
  const [state, setState] = useState<SimState>(IDLE);

  const variants = useMemo(
    () => (useB && copyB.trim() ? [copyA, copyB] : [copyA]),
    [copyA, copyB, useB],
  );

  async function generateB() {
    if (!copyA.trim() || generatingB) return;
    setGeneratingB(true);
    setBError("");
    try {
      const res = await postJson<{ variant: string; angle: string }>("/api/generate-variant", {
        copy: copyA,
      });
      setCopyB(res.variant);
      setBAngle(res.angle);
      setUseB(true);
    } catch (err) {
      setBError(err instanceof Error ? err.message : "Could not generate variant B");
    } finally {
      setGeneratingB(false);
    }
  }

  async function run() {
    if (!audience) return;
    setState({ ...IDLE, streaming: true });
    setStep("simulate");
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: audience.id, variants }),
      });
      if (!res.ok) throw new Error("Simulation failed");
      await readNdjson(res, (event) => {
        if (event.type === "variant_start") {
          const d = event.data as { variantId: string; copy: string };
          setState((s) => ({ ...s, stageLabel: d.copy }));
        }
        if (event.type === "variant_done") {
          const d = event.data as { variantId: string; avgScore: number };
          setState((s) => ({ ...s, stageLabel: `Variant ${d.variantId} done` }));
        }
        if (event.type === "reactions") {
          const d = event.data as { variantId: string; reactions: Reaction[] };
          setState((s) =>
            d.variantId === "variant-2"
              ? { ...s, variantB: [...s.variantB, ...d.reactions] }
              : { ...s, variantA: [...s.variantA, ...d.reactions] },
          );
        }
        if (event.type === "results") {
          setState((s) => ({ ...s, result: event.data as SimulationResult }));
        }
        if (event.type === "rewrite") {
          setState((s) => ({
            ...s,
            rewrite: event.data as { rewrite: string; why: string },
          }));
        }
        if (event.type === "done") {
          setState((s) => ({ ...s, streaming: false }));
          setStep("results");
        }
        if (event.type === "error") {
          const d = event.data as { message: string };
          setState((s) => ({ ...s, streaming: false, error: d.message }));
        }
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        streaming: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }

  return (
    <main className="flex-1">
      <header className="sticky top-0 z-10 bg-paper/80 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight">Reactor</span>
          <span className="text-sm text-ink-2">Simulate your audience before you post</span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Stepper step={step} />

        {step === "audience" && (
          <AudiencePicker
            selected={audience}
            onSelect={(a) => {
              setAudience(a);
              setStep("copy");
            }}
          />
        )}

        {step === "copy" && (
          <CopyEditor
            copyA={copyA}
            setCopyA={setCopyA}
            copyB={copyB}
            setCopyB={setCopyB}
            useB={useB}
            setUseB={setUseB}
            canRun={copyA.trim().length > 0}
            generatingB={generatingB}
            bAngle={bAngle}
            bError={bError}
            onGenerateB={generateB}
            onBack={() => setStep("audience")}
            onRun={run}
          />
        )}

        {step === "simulate" && (
          <SimulationView
            state={state}
            audienceName={audience?.name ?? ""}
            hasB={variants.length === 2}
          />
        )}

        {step === "results" && state.result && (
          <ResultsView state={state} onRerun={() => setStep("copy")} />
        )}
      </section>
    </main>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels: Record<Step, string> = {
    audience: "Audience",
    copy: "Copy",
    simulate: "Simulate",
    results: "Results",
  };
  const order: Step[] = ["audience", "copy", "simulate", "results"];
  const current = order.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-10 text-sm">
      {order.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${
              i <= current ? "bg-ink-1 text-white" : "bg-mist-2 text-ink-3"
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= current ? "text-ink-1 font-medium" : "text-ink-3"}>
            {labels[s]}
          </span>
          {i < order.length - 1 && <span className="h-px w-6 bg-line" />}
        </div>
      ))}
    </div>
  );
}

function AudiencePicker({
  selected,
  onSelect,
}: {
  selected: Audience | null;
  onSelect: (a: Audience) => void;
}) {
  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tight text-balance">
        Choose who you&apos;re posting to.
      </h1>
      <p className="mt-3 text-ink-2">
        Pick a simulated audience. Reactor clones their bios, interests and engagement styles.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {AUDIENCES.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            className={`lift rounded-2xl border p-5 text-left ${
              selected?.id === a.id ? "border-blue-1" : "border-line bg-paper"
            }`}
          >
            <h2 className="font-semibold text-lg">{a.name}</h2>
            <p className="mt-2 text-sm text-ink-2">{a.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {a.segments.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-mist px-2.5 py-0.5 text-xs text-ink-2"
                >
                  {s.label}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-3">
              {a.profiles.length} followers simulated
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function CopyEditor({
  copyA,
  setCopyA,
  copyB,
  setCopyB,
  useB,
  setUseB,
  canRun,
  generatingB,
  bAngle,
  bError,
  onGenerateB,
  onBack,
  onRun,
}: {
  copyA: string;
  setCopyA: (v: string) => void;
  copyB: string;
  setCopyB: (v: string) => void;
  useB: boolean;
  setUseB: (v: boolean) => void;
  canRun: boolean;
  generatingB: boolean;
  bAngle: string;
  bError: string;
  onGenerateB: () => void;
  onBack: () => void;
  onRun: () => void;
}) {
  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tight text-balance">
        Write your launch copy.
      </h1>
      <p className="mt-3 text-ink-2">
        Paste the post or announcement. Add a second variant to A/B test against the same audience.
      </p>
      <div className="mt-8 grid gap-4">
        <label className="block">
          <span className="text-sm font-medium text-ink-1">Variant A</span>
          <textarea
            value={copyA}
            onChange={(e) => setCopyA(e.target.value)}
            rows={6}
            placeholder="We just shipped the fastest onboarding in SaaS…"
            className="mt-2 w-full rounded-xl border border-line bg-paper p-4 text-sm focus:outline-none focus:border-blue-1 resize-y"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={onGenerateB}
            disabled={generatingB || !copyA.trim()}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-medium disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-1"
          >
            {generatingB
              ? "Generating…"
              : useB && copyB.trim()
                ? "Regenerate variant B"
                : "Generate variant B"}
          </button>
          {bAngle && <span className="text-xs text-ink-3">Angle: {bAngle}</span>}
        </div>
        {bError && (
          <p className="mt-3 rounded-xl bg-pink-1/10 p-3 text-sm text-pink-1">{bError}</p>
        )}

        <label className="flex items-center gap-2 text-sm font-medium text-ink-1">
          <input
            type="checkbox"
            checked={useB}
            onChange={(e) => setUseB(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          Add variant B for A/B testing
        </label>

        {useB && (
          <label className="block fade-up">
            <span className="text-sm font-medium text-ink-1">Variant B</span>
            <textarea
              value={copyB}
              onChange={(e) => setCopyB(e.target.value)}
              rows={6}
              placeholder="Onboard 3x faster, or the first month is free…"
              className="mt-2 w-full rounded-xl border border-line bg-paper p-4 text-sm focus:outline-none focus:border-blue-1 resize-y"
            />
          </label>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-1"
        >
          Back
        </button>
        <button
          onClick={onRun}
          disabled={!canRun}
          className="rounded-full bg-blue-1 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-1 focus-visible:ring-offset-2"
        >
          Simulate my launch
        </button>
      </div>
    </div>
  );
}

function SimulationView({
  state,
  audienceName,
  hasB,
}: {
  state: SimState;
  audienceName: string;
  hasB: boolean;
}) {
  const total = state.variantA.length + state.variantB.length;
  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tight text-balance">
        Simulating {audienceName}.
      </h1>
      <p className="mt-3 text-ink-2">
        Clones are reacting to your copy in real time.
      </p>
      {state.stageLabel && (
        <p className="mt-2 text-sm text-ink-3">{state.stageLabel}</p>
      )}
      {state.error && (
        <p className="mt-4 rounded-xl bg-pink-1/10 p-4 text-sm text-pink-1">{state.error}</p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <EngagementTicker label="Variant A" reactions={state.variantA} />
        {hasB && <EngagementTicker label="Variant B" reactions={state.variantB} />}
      </div>
      <div className="mt-8 flex items-center gap-2 text-sm text-ink-2">
        <span className="h-2 w-2 rounded-full bg-blue-1 pulse-dot" />
        {total} reactions streamed
      </div>
      <div className="mt-6 grid gap-2">
        {state.variantA.map((r) => (
          <ReactionCard key={r.followerId} reaction={r} />
        ))}
        {state.variantB.map((r) => (
          <ReactionCard key={r.followerId} reaction={r} />
        ))}
      </div>
    </div>
  );
}

function EngagementTicker({
  label,
  reactions,
}: {
  label: string;
  reactions: Reaction[];
}) {
  const e = useMemo(
    () => sumEngagement(reactions.map(engagementFromReaction)),
    [reactions],
  );
  const stats = [
    { label: "Likes", value: e.likes },
    { label: "Replies", value: e.replies },
    { label: "Reposts", value: e.reposts },
    { label: "Impressions", value: e.impressions },
  ];
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-ink-3">{reactions.length} reactions</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-xl font-semibold tabular-nums">{s.value.toLocaleString()}</div>
            <div className="text-[11px] text-ink-3">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReactionCard({ reaction }: { reaction: Reaction }) {
  return (
    <div className="fade-up rounded-xl border border-line p-4 flex items-start gap-3">
      <div className="h-8 w-8 shrink-0 rounded-full bg-mist-2 flex items-center justify-center text-xs font-semibold">
        {reaction.handle.slice(1, 3)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{reaction.name}</span>
          <span className="text-xs text-ink-3">{reaction.handle}</span>
          <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-ink-2">
            {reaction.segment}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-1">{reaction.comment}</p>
        {reaction.objection && (
          <p className="mt-2 text-xs text-orange-1">⚠ {reaction.objection}</p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
          reaction.score >= 70
            ? "bg-green-1/15 text-green-1"
            : reaction.score >= 40
              ? "bg-orange-1/15 text-orange-1"
              : "bg-pink-1/15 text-pink-1"
        }`}
      >
        {reaction.score}
      </span>
    </div>
  );
}

function ResultsView({ state, onRerun }: { state: SimState; onRerun: () => void }) {
  const result = state.result!;
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Your audience has spoken.
        </h1>
        <button
          onClick={onRerun}
          className="shrink-0 rounded-full border border-line px-5 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-1"
        >
          Edit copy
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {result.variants.map((v) => (
          <div
            key={v.variantId}
            className={`rounded-2xl border p-5 ${
              v.variantId === result.bestVariantId ? "border-green-1 bg-green-1/5" : "border-line"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wide text-ink-3">
                Variant {v.variantId === "variant-1" ? "A" : "B"}
              </span>
              {v.variantId === result.bestVariantId && (
                <span className="rounded-full bg-green-1/15 px-2.5 py-0.5 text-xs font-semibold text-green-1">
                  Winner
                </span>
              )}
            </div>
            <div className="mt-4 text-5xl font-semibold tracking-tight">{v.avgScore}</div>
            <div className="mt-1 text-sm text-ink-3">avg engagement score</div>
            <p className="mt-4 text-sm text-ink-2 line-clamp-3">{v.copy}</p>

            <div className="mt-5">
              <div className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
                Objections
              </div>
              {v.objectionClusters.length === 0 ? (
                <p className="mt-2 text-sm text-ink-3">No major objections raised.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {v.objectionClusters.map((c) => (
                    <div key={c.objection} className="flex items-center justify-between text-sm">
                      <span className="text-ink-2 capitalize">{c.objection}</span>
                      <span className="font-semibold">{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
                By segment
              </div>
              <div className="mt-2 space-y-2">
                {v.segmentScores.map((s) => (
                  <div key={s.segment}>
                    <div className="flex justify-between text-xs text-ink-2">
                      <span className="capitalize">{s.segment}</span>
                      <span>{s.avg}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-mist-2">
                      <div
                        className="progress-fill h-1.5 rounded-full"
                        style={{ width: `${s.avg}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
                Engagement
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold tabular-nums">
                    {v.engagement.likes.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-ink-3">Likes</div>
                </div>
                <div>
                  <div className="text-lg font-semibold tabular-nums">
                    {v.engagement.replies.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-ink-3">Replies</div>
                </div>
                <div>
                  <div className="text-lg font-semibold tabular-nums">
                    {v.engagement.reposts.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-ink-3">Reposts</div>
                </div>
                <div>
                  <div className="text-lg font-semibold tabular-nums">
                    {v.engagement.impressions.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-ink-3">Impressions</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {state.rewrite && (
        <div className="mt-6 fade-up rounded-2xl border border-blue-1/40 bg-blue-1/5 p-6">
          <div className="text-xs font-semibold text-blue-1 uppercase tracking-wide">
            Recommended rewrite
          </div>
          <p className="mt-3 text-lg leading-relaxed">{state.rewrite.rewrite}</p>
          <p className="mt-3 text-sm text-ink-2">{state.rewrite.why}</p>
        </div>
      )}
    </div>
  );
}