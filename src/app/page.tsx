"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import AudienceGraph, { type NodeDatum } from "@/components/AudienceGraph";
import Composer from "@/components/Composer";
import ReactionFeed from "@/components/ReactionFeed";
import Results from "@/components/Results";
import {
  AnimatedNumber,
  BandLegend,
  Sparkline,
  VARIANT_COLOR,
  compact,
  runningAvg,
  variantLetter,
} from "@/components/Viz";
import { AUDIENCES } from "@/lib/audiences";
import {
  addAudience,
  getServerSnapshot,
  getSnapshot,
  removeAudience,
  subscribe,
} from "@/lib/audience-store";
import { postJson, readNdjson } from "@/lib/client-utils";
import { engagementFromReaction, sumEngagement } from "@/lib/engagement";
import { EMPTY_CAMPAIGN, type Campaign } from "@/lib/campaign";
import { applyFilter, bandCounts, isFiltered, NO_FILTER, type Filter } from "@/lib/filters";
import { BAND_COLOR, bandFor, buildGraph } from "@/lib/graph";
import {
  TAIL_INTERVAL_MS,
  emptyQueue,
  intervalFor,
  pickNext,
  type PacerQueue,
  type TailEvent,
} from "@/lib/pacer";
import { verdictFor } from "@/lib/verdict";
import type { Audience, Reaction, RewriteResult, SimulationResult } from "@/lib/types";

type View = "variant-1" | "variant-2" | "diff";

type SimState = {
  streaming: boolean;
  variantA: Reaction[];
  variantB: Reaction[];
  result?: SimulationResult;
  rewrite?: RewriteResult;
  error?: string;
  status: string;
};

const IDLE: SimState = {
  streaming: false,
  variantA: [],
  variantB: [],
  status: "",
};

const NEUTRAL = "#86868b";
/** below this, a score change is noise rather than a real shift in opinion */
const DELTA_FLOOR = 4;

export default function Home() {
  const customAudiences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const audiences = useMemo(() => [...customAudiences, ...AUDIENCES], [customAudiences]);
  const builtInIds = useMemo(() => new Set(AUDIENCES.map((a) => a.id)), []);

  const [audienceId, setAudienceId] = useState<string>(AUDIENCES[0].id);
  const audience = useMemo(
    () => audiences.find((a) => a.id === audienceId) ?? AUDIENCES[0],
    [audiences, audienceId],
  );

  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState("");
  const [genError, setGenError] = useState("");
  const [copyA, setCopyA] = useState("");
  const [copyB, setCopyB] = useState("");
  const [useB, setUseB] = useState(false);
  const [generatingB, setGeneratingB] = useState(false);
  const [bAngle, setBAngle] = useState("");
  const [bError, setBError] = useState("");

  const [campaign, setCampaign] = useState<Campaign>(EMPTY_CAMPAIGN);

  const [state, setState] = useState<SimState>(IDLE);
  const [view, setView] = useState<View>("variant-1");
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverSegment, setHoverSegment] = useState<string | null>(null);

  const graph = useMemo(() => buildGraph(audience), [audience]);

  // Switching audience invalidates every reaction on screen. A run in flight
  // belongs to the old audience: its follower ids mean nothing here, so cancel
  // the request and throw away whatever the pacer had queued.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    queueRef.current = emptyQueue(false);
    streamingRef.current = false;
    setState(IDLE);
    setView("variant-1");
    setFilter(NO_FILTER);
    setSelectedId(null);
  }, [audienceId]);

  const mapA = useMemo(
    () => new Map(state.variantA.map((r) => [r.followerId, r])),
    [state.variantA],
  );
  const mapB = useMemo(
    () => new Map(state.variantB.map((r) => [r.followerId, r])),
    [state.variantB],
  );

  const hasB = state.variantB.length > 0 || (useB && copyB.trim().length > 0);
  const expected = audience.profiles.length;
  const received = state.variantA.length + state.variantB.length;
  const totalExpected = expected * (hasB ? 2 : 1);

  /** What each node is painted with — score bands, or A-vs-B delta in diff mode. */
  const nodeData = useMemo(() => {
    const out = new Map<string, NodeDatum>();
    if (view === "diff") {
      for (const n of graph.nodes) {
        const a = mapA.get(n.id);
        const b = mapB.get(n.id);
        if (!a || !b) continue;
        const delta = b.score - a.score;
        const color =
          delta > DELTA_FLOOR
            ? VARIANT_COLOR["variant-2"]
            : delta < -DELTA_FLOOR
              ? VARIANT_COLOR["variant-1"]
              : NEUTRAL;
        out.set(n.id, {
          color,
          intensity: Math.min(Math.abs(delta) / 40, 1),
          reaction: b,
          note: `${delta > 0 ? "+" : ""}${delta} vs A`,
        });
      }
      return out;
    }
    const src = view === "variant-2" ? mapB : mapA;
    for (const [id, r] of src) {
      out.set(id, {
        color: BAND_COLOR[bandFor(r.score)],
        intensity: r.score / 100,
        reaction: r,
      });
    }
    return out;
  }, [view, graph, mapA, mapB]);

  const feedReactions = view === "variant-1" ? state.variantA : state.variantB;

  const highlight = useMemo(() => {
    if (hoverSegment) {
      return new Set(
        graph.nodes.filter((n) => n.segment === hoverSegment).map((n) => n.id),
      );
    }
    if (!isFiltered(filter)) return null;
    return new Set(applyFilter(feedReactions, filter).map((r) => r.followerId));
  }, [hoverSegment, graph, filter, feedReactions]);

  const diffStats = useMemo(() => {
    let up = 0;
    let down = 0;
    let flat = 0;
    let converted = 0;
    for (const n of graph.nodes) {
      const a = mapA.get(n.id);
      const b = mapB.get(n.id);
      if (!a || !b) continue;
      const d = b.score - a.score;
      if (d > DELTA_FLOOR) up++;
      else if (d < -DELTA_FLOOR) down++;
      else flat++;
      if (bandFor(a.score) !== "strong" && bandFor(b.score) === "strong") converted++;
    }
    return { up, down, flat, converted };
  }, [graph, mapA, mapB]);

  // ---- paced reveal -------------------------------------------------------
  // The network fills this queue; a timer drains it. Nothing the server sends
  // reaches the screen directly, which is what makes the reveal watchable.
  const queueRef = useRef<PacerQueue>(emptyQueue(false));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef(300);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const stopPacer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopPacer, [stopPacer]);

  const applyTail = useCallback((event: TailEvent) => {
    if (event.kind === "results") {
      const result = event.data as SimulationResult;
      setState((s) => ({ ...s, result, status: "" }));
      setView(result.bestVariantId as View);
    }
    if (event.kind === "rewrite") {
      setState((s) => ({ ...s, rewrite: event.data as RewriteResult }));
    }
    if (event.kind === "done") {
      streamingRef.current = false;
      setState((s) => ({ ...s, streaming: false, status: "" }));
    }
  }, []);

  /** Release one queued item, then schedule the next. */
  const drip = useCallback(() => {
    const q = queueRef.current;
    const next = pickNext(q);

    if (next.type === "end") {
      timerRef.current = null;
      return;
    }
    if (next.type === "wait") {
      timerRef.current = setTimeout(drip, 110);
      return;
    }
    if (next.type === "reactions") {
      const fresh: Record<string, Reaction[]> = { "variant-1": [], "variant-2": [] };
      for (const item of next.items) {
        (item.variantId === "variant-2" ? q.b : q.a).shift();
        fresh[item.variantId].push(item.reaction);
      }
      setState((s) => ({
        ...s,
        variantA: fresh["variant-1"].length ? [...s.variantA, ...fresh["variant-1"]] : s.variantA,
        variantB: fresh["variant-2"].length ? [...s.variantB, ...fresh["variant-2"]] : s.variantB,
        status: "Reading the room…",
      }));
      timerRef.current = setTimeout(drip, intervalRef.current);
      return;
    }
    q.tail.shift();
    applyTail(next.event);
    timerRef.current = setTimeout(drip, TAIL_INTERVAL_MS);
  }, [applyTail]);

  /**
   * Dump everything queued straight onto the screen. The pacer keeps running
   * at zero delay: the network is usually still streaming, and stopping here
   * would strand every reaction that has not arrived yet.
   */
  const skipReveal = useCallback(() => {
    const q = queueRef.current;
    const a = q.a.splice(0);
    const b = q.b.splice(0);
    if (a.length || b.length) {
      setState((s) => ({
        ...s,
        variantA: [...s.variantA, ...a],
        variantB: [...s.variantB, ...b],
      }));
    }
    const tail = q.tail.splice(0);
    for (const event of tail) applyTail(event);
    intervalRef.current = 0;
    if (timerRef.current === null) timerRef.current = setTimeout(drip, 0);
  }, [applyTail, drip]);

  async function generateAudience(icp: string) {
    if (generating || icp.trim().length < 12) return;
    setGenerating(true);
    setGenError("");
    setGenStage("Waking the writer…");
    try {
      const res = await fetch("/api/generate-audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icp }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not build that audience");
      }
      let built: Audience | null = null;
      await readNdjson(res, (event) => {
        if (event.type === "stage") {
          setGenStage((event.data as { label: string }).label);
        }
        if (event.type === "audience") {
          built = event.data as Audience;
        }
        if (event.type === "error") {
          setGenError((event.data as { message: string }).message);
        }
      });
      if (built) {
        const made = built as Audience;
        addAudience(made);
        setAudienceId(made.id);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Could not build that audience");
    } finally {
      setGenerating(false);
      setGenStage("");
    }
  }

  function deleteAudience(id: string) {
    removeAudience(id);
    if (audienceId === id) setAudienceId(AUDIENCES[0].id);
  }

  async function generateB() {
    if (!copyA.trim() || generatingB) return;
    setGeneratingB(true);
    setBError("");
    try {
      const res = await postJson<{ variant: string; angle: string }>(
        "/api/generate-variant",
        { copy: copyA },
      );
      setCopyB(res.variant);
      setBAngle(res.angle);
      setUseB(true);
    } catch (err) {
      setBError(err instanceof Error ? err.message : "Could not draft variant B");
    } finally {
      setGeneratingB(false);
    }
  }

  // true from the moment a run starts until the reveal finishes — the network
  // finishing early is exactly what the pacer is hiding, so it cannot be the
  // signal that lets another run start
  const streamingRef = useRef(false);

  const run = useCallback(
    async (override?: string[]) => {
      const list = (override ?? (useB && copyB.trim() ? [copyA, copyB] : [copyA]))
        .map((v) => v.trim())
        .filter(Boolean);
      if (list.length === 0 || streamingRef.current) return;

      streamingRef.current = true;
      setState({ ...IDLE, streaming: true, status: "Waking the clones…" });
      setView("variant-1");
      setFilter(NO_FILTER);
      setSelectedId(null);

      const twoVariants = list.length === 2;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      stopPacer();
      queueRef.current = emptyQueue(twoVariants);
      // one step reveals one follower per variant, so the headcount is the
      // step count whether we are running one variant or two
      intervalRef.current = reducedRef.current ? 0 : intervalFor(audience.profiles.length);
      timerRef.current = setTimeout(drip, intervalRef.current);

      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            audienceId: audience.id,
            variants: list,
            campaign,
            // generated audiences only exist in this browser
            ...(builtInIds.has(audience.id) ? {} : { profiles: audience.profiles }),
          }),
        });
        if (!res.ok) throw new Error("Simulation failed");

        // everything lands in the queue; the pacer decides when it is seen
        await readNdjson(res, (event) => {
          const q = queueRef.current;
          if (event.type === "reactions") {
            const d = event.data as { variantId: string; reactions: Reaction[] };
            (d.variantId === "variant-2" ? q.b : q.a).push(...d.reactions);
          }
          if (event.type === "variant_done") {
            const d = event.data as { variantId: string };
            if (d.variantId === "variant-2") q.bComplete = true;
            else q.aComplete = true;
          }
          if (event.type === "results") {
            q.tail.push({ kind: "results", data: event.data });
          }
          if (event.type === "rewrite") {
            q.tail.push({ kind: "rewrite", data: event.data });
          }
          if (event.type === "done") {
            q.tail.push({ kind: "done" });
          }
          if (event.type === "error") {
            // failures are not entertainment — show them at once
            const d = event.data as { message: string };
            stopPacer();
            streamingRef.current = false;
            setState((s) => ({ ...s, streaming: false, status: "", error: d.message }));
          }
        });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        stopPacer();
        streamingRef.current = false;
        setState((s) => ({
          ...s,
          streaming: false,
          status: "",
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    },
    [audience, builtInIds, campaign, copyA, copyB, useB, drip, stopPacer],
  );

  // ⌘↵ / Ctrl+↵ runs from anywhere, including inside the textareas
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  function testRewrite() {
    if (!state.result || !state.rewrite) return;
    const best = state.result.variants.find(
      (v) => v.variantId === state.result!.bestVariantId,
    );
    if (!best) return;
    setCopyA(best.copy);
    setCopyB(state.rewrite.rewrite);
    setUseB(true);
    setBAngle("objection-proof rewrite");
    void run([best.copy, state.rewrite.rewrite]);
  }

  const verdict = state.result
    ? verdictFor(state.result.variants, state.result.bestVariantId)
    : null;
  // only badge a winner when the gap is bigger than the noise between runs
  const winnerId =
    verdict?.runnerUp && verdict.decisive ? verdict.best.variantId : null;

  const viewedVariant =
    state.result &&
    (state.result.variants.find((v) => v.variantId === view) ??
      state.result.variants.find((v) => v.variantId === state.result!.bestVariantId) ??
      state.result.variants[0]);

  const canRun = copyA.trim().length > 0 && !state.streaming;
  const started = received > 0 || state.streaming;

  const tabs: { id: View; label: string; color: string }[] = [
    { id: "variant-1", label: "Variant A", color: VARIANT_COLOR["variant-1"] },
    ...(state.variantB.length > 0
      ? [
          { id: "variant-2" as View, label: "Variant B", color: VARIANT_COLOR["variant-2"] },
          { id: "diff" as View, label: "Δ Compare", color: "#1d1d1f" },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line-2 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-5 sm:px-6">
          <span className="display text-[17px]">Reactor</span>
          <span className="hidden text-[13px] text-ink-2 sm:inline">
            Read the room before you post
          </span>
          <div className="ml-auto flex items-center gap-3">
            {state.streaming && (
              <>
                <span className="flex items-center gap-2 text-[12px] text-ink-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full pulse-dot"
                    style={{ background: VARIANT_COLOR["variant-1"] }}
                  />
                  <span className="font-mono">
                    {received}/{totalExpected}
                  </span>
                  <span className="hidden sm:inline">{state.status}</span>
                </span>
                <button
                  type="button"
                  onClick={skipReveal}
                  className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-mist hover:text-ink-1"
                >
                  Skip
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => void run()}
              disabled={!canRun}
              className="rounded-full bg-ink-1 px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-25 focus-visible:ring-2 focus-visible:ring-blue-1 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {state.streaming ? "Simulating…" : "Run simulation"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 pt-10 pb-16 sm:px-6">
        <h1 className="display max-w-2xl text-4xl text-balance sm:text-5xl">
          Watch your audience react before anyone real does.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">
          {audience.profiles.length} simulated followers, clustered by what they care about.
          Post your copy and watch the room turn — one clone at a time.
        </p>

        <div className="mt-9 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="card lg:sticky lg:top-20 p-5">
            <Composer
              audiences={audiences}
              audience={audience}
              onAudience={(a) => setAudienceId(a.id)}
              builtInIds={builtInIds}
              onGenerate={generateAudience}
              campaign={campaign}
              setCampaign={setCampaign}
              onDeleteAudience={deleteAudience}
              generating={generating}
              genStage={genStage}
              genError={genError}
              copyA={copyA}
              setCopyA={setCopyA}
              copyB={copyB}
              setCopyB={setCopyB}
              useB={useB}
              setUseB={setUseB}
              generatingB={generatingB}
              bAngle={bAngle}
              bError={bError}
              onGenerateB={generateB}
              onRun={() => void run()}
              running={state.streaming}
              disabled={!canRun}
            />
          </aside>

          <div className="min-w-0 space-y-5">
            {state.error && (
              <div className="card border-pink-1/30 bg-pink-1/[0.04] p-4 text-[13px] text-pink-1">
                {state.error}
              </div>
            )}

            {/* ---------------- the field ---------------- */}
            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line-2 px-5 py-3.5">
                <div className="flex gap-1">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setView(t.id)}
                      aria-pressed={view === t.id}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        view === t.id ? "text-white" : "text-ink-2 hover:bg-mist"
                      }`}
                      style={view === t.id ? { background: t.color } : undefined}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="ml-auto">
                  {view === "diff" ? (
                    <div className="flex items-center gap-x-4 gap-y-1 text-[11px] text-ink-2">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: VARIANT_COLOR["variant-2"] }}
                        />
                        B landed better
                        <span className="font-mono text-ink-3">{diffStats.up}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: VARIANT_COLOR["variant-1"] }}
                        />
                        A landed better
                        <span className="font-mono text-ink-3">{diffStats.down}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-ink-3" />
                        Unmoved
                        <span className="font-mono text-ink-3">{diffStats.flat}</span>
                      </span>
                    </div>
                  ) : (
                    <BandLegend counts={bandCounts(feedReactions)} />
                  )}
                </div>
              </div>

              {state.streaming && (
                <div className="h-0.5 w-full bg-mist-2">
                  <div
                    className="bar-fill h-0.5 bg-blue-1"
                    style={{ width: `${(received / Math.max(totalExpected, 1)) * 100}%` }}
                  />
                </div>
              )}

              <div className="graph-field relative">
                <AudienceGraph
                  graph={graph}
                  data={nodeData}
                  highlight={highlight}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  className="h-[360px] w-full sm:h-[460px]"
                />

                {!started && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
                    <span className="rounded-full border border-line-2 bg-paper/90 px-4 py-2 text-[12px] text-ink-2 backdrop-blur">
                      {audience.name} · {audience.profiles.length} clones waiting. Hover any one of
                      them.
                    </span>
                  </div>
                )}

                {view === "diff" && diffStats.converted > 0 && (
                  <div className="pointer-events-none absolute top-4 left-5">
                    <span className="rounded-full bg-ink-1 px-3 py-1.5 text-[12px] font-medium text-white">
                      {diffStats.converted}{" "}
                      {diffStats.converted === 1 ? "follower" : "followers"} flipped into engaging
                    </span>
                  </div>
                )}
              </div>

              {/* ---------------- live numbers ---------------- */}
              <div className="border-t border-line-2 px-5 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <VariantStat
                    variantId="variant-1"
                    reactions={state.variantA}
                    expected={expected}
                    best={winnerId === "variant-1"}
                    active={state.streaming && state.variantA.length < expected}
                    animate={state.streaming}
                  />
                  {(state.variantB.length > 0 || (state.streaming && hasB)) && (
                    <VariantStat
                      variantId="variant-2"
                      reactions={state.variantB}
                      expected={expected}
                      best={winnerId === "variant-2"}
                      active={state.streaming && state.variantB.length < expected}
                      animate={state.streaming}
                    />
                  )}
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px] text-ink-3">
                    <span className="tracking-widest uppercase">Score trajectory</span>
                    <span>ticks are individual clones · the line is the running average</span>
                  </div>
                  <Sparkline
                    total={expected}
                    series={[
                      {
                        id: "a",
                        color: VARIANT_COLOR["variant-1"],
                        points: runningAvg(state.variantA.map((r) => r.score)),
                        raw: state.variantA.map((r) => r.score),
                      },
                      {
                        id: "b",
                        color: VARIANT_COLOR["variant-2"],
                        points: runningAvg(state.variantB.map((r) => r.score)),
                        raw: state.variantB.map((r) => r.score),
                      },
                    ]}
                  />
                </div>
              </div>
            </section>

            {state.result && viewedVariant && (
              <Results
                result={state.result}
                segments={audience.segments}
                viewed={viewedVariant}
                rewrite={state.rewrite}
                filter={filter}
                onFilter={setFilter}
                onHoverSegment={setHoverSegment}
                activeSegment={hoverSegment}
                onTestRewrite={testRewrite}
                busy={state.streaming}
              />
            )}

            {feedReactions.length > 0 && (
              <section className="card p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                    Every reaction
                  </h2>
                  <span className="font-mono text-[11px] text-ink-3">
                    variant {view === "variant-1" ? "A" : "B"}
                  </span>
                </div>
                <ReactionFeed
                  reactions={feedReactions}
                  segments={audience.segments}
                  clusters={viewedVariant?.objectionClusters.map((c) => c.objection) ?? []}
                  filter={filter}
                  onFilter={setFilter}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function VariantStat({
  variantId,
  reactions,
  expected,
  best,
  active = false,
  animate = false,
}: {
  variantId: string;
  reactions: Reaction[];
  expected: number;
  best: boolean;
  /** currently being revealed — the card everyone should be looking at */
  active?: boolean;
  animate?: boolean;
}) {
  const color = VARIANT_COLOR[variantId];
  const avg =
    reactions.length === 0
      ? 0
      : Math.round((reactions.reduce((s, r) => s + r.score, 0) / reactions.length) * 10) / 10;
  const e = sumEngagement(reactions.map(engagementFromReaction));

  return (
    <div
      className="rounded-2xl border p-3.5 transition-all duration-300"
      style={{
        borderColor: active ? color : "var(--color-line-2)",
        background: active ? `${color}08` : undefined,
        boxShadow: active ? `0 0 0 3px ${color}14` : undefined,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: color }}
        >
          {variantLetter(variantId)}
        </span>
        {active && (
          <span
            className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase"
            style={{ color }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full pulse-dot"
              style={{ background: color }}
            />
            Live
          </span>
        )}
        {best && (
          <span className="rounded-full bg-green-1/12 px-2 py-0.5 text-[10px] font-semibold text-green-1">
            WINNER
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-3">
          {reactions.length}/{expected}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <AnimatedNumber
          value={avg}
          animate={animate}
          format={(n) => n.toFixed(1)}
          className="numeral text-4xl"
          style={{ color }}
        />
        <span className="text-[11px] text-ink-3">avg score</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-mist-2">
        <div
          className="bar-fill h-1 rounded-full"
          style={{ width: `${Math.max(avg, 1)}%`, background: color }}
        />
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-1 text-center">
        {(
          [
            ["Likes", e.likes],
            ["Replies", e.replies],
            ["Reposts", e.reposts],
            ["Views", e.impressions],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dd className="numeral text-[15px]">
              <AnimatedNumber value={value} animate={animate} format={compact} />
            </dd>
            <dt className="text-[10px] text-ink-3">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
