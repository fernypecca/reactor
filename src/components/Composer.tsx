"use client";

import { useState } from "react";
import { GOALS, type Campaign } from "@/lib/campaign";
import { pickExample } from "@/lib/examples";
import { ImportError, parseImportedAudience } from "@/lib/import-audience";
import type { Audience } from "@/lib/types";
import { VARIANT_COLOR } from "./Viz";

type Props = {
  audiences: Audience[];
  audience: Audience;
  onAudience: (a: Audience) => void;
  builtInIds: Set<string>;
  onGenerate: (icp: string) => void;
  onImport: (audience: Audience) => void;
  campaign: Campaign;
  setCampaign: (c: Campaign) => void;
  onDeleteAudience: (id: string) => void;
  generating: boolean;
  genStage: string;
  genError: string;
  copyA: string;
  setCopyA: (v: string) => void;
  copyB: string;
  setCopyB: (v: string) => void;
  useB: boolean;
  setUseB: (v: boolean) => void;
  generatingB: boolean;
  bAngle: string;
  bError: string;
  onGenerateB: () => void;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
      {children}
    </div>
  );
}

function CharCount({ value }: { value: string }) {
  const n = value.trim().length;
  const over = n > 280;
  return (
    <span className={`font-mono text-[11px] ${over ? "text-orange-1" : "text-ink-3"}`}>
      {n}
      {over && " · over 280"}
    </span>
  );
}

export default function Composer({
  audiences,
  audience,
  onAudience,
  builtInIds,
  onGenerate,
  onImport,
  campaign,
  setCampaign,
  onDeleteAudience,
  generating,
  genStage,
  genError,
  copyA,
  setCopyA,
  copyB,
  setCopyB,
  useB,
  setUseB,
  generatingB,
  bAngle,
  bError,
  onGenerateB,
  onRun,
  running,
  disabled,
}: Props) {
  return (
    <div className="space-y-7">
      <section>
        <Label>Audience</Label>
        <div className="mt-3 space-y-2">
          {audiences.map((a) => {
            const active = a.id === audience.id;
            const custom = !builtInIds.has(a.id);
            return (
              <div
                key={a.id}
                className={`lift relative rounded-2xl border ${
                  active
                    ? "border-blue-1 bg-blue-1/[0.04]"
                    : "border-line-2 bg-paper hover:border-line"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onAudience(a)}
                  aria-pressed={active}
                  className="block w-full p-3.5 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold">{a.name}</span>
                      {custom && (
                        <span className="shrink-0 rounded-full bg-violet-1/12 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-violet-1 uppercase">
                          Yours
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-ink-3">
                      {a.profiles.length}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-2">
                    {a.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.segments.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-mist px-2 py-0.5 text-[10px] text-ink-2"
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                </button>
                {custom && (
                  <button
                    type="button"
                    onClick={() => onDeleteAudience(a.id)}
                    aria-label={`Delete ${a.name}`}
                    className="absolute right-2 bottom-2 rounded-full px-2 py-1 text-[11px] text-ink-3 transition-colors hover:bg-mist hover:text-pink-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <IcpBuilder
          onGenerate={onGenerate}
          generating={generating}
          stage={genStage}
          error={genError}
        />

        <ImportBuilder onImport={onImport} />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <Label>Your post</Label>
          <button
            type="button"
            onClick={() => {
              // randomised in the handler, never during render
              setCopyA(pickExample(copyA));
              setUseB(false);
              setCopyB("");
            }}
            className="text-[12px] font-medium text-blue-1 hover:underline"
          >
            {copyA.trim() ? "Try another example" : "Use an example"}
          </button>
        </div>

        <div className="field mt-3 p-3">
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-semibold"
              style={{ color: VARIANT_COLOR["variant-1"] }}
            >
              VARIANT A
            </span>
            <CharCount value={copyA} />
          </div>
          <textarea
            value={copyA}
            onChange={(e) => setCopyA(e.target.value)}
            rows={5}
            placeholder="Paste the post you're about to publish…"
            className="mt-2 w-full resize-y bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-ink-3"
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerateB}
            disabled={generatingB || !copyA.trim()}
            className="rounded-full border border-line px-3.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-mist disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-1 focus-visible:outline-none"
          >
            {generatingB ? "Writing…" : useB && copyB.trim() ? "Rewrite B" : "Draft variant B"}
          </button>
          {!useB && copyA.trim() && (
            <button
              type="button"
              onClick={() => setUseB(true)}
              className="text-[12px] text-ink-2 hover:text-ink-1"
            >
              or write it myself
            </button>
          )}
          {bAngle && useB && (
            <span className="truncate text-[11px] text-ink-3">Angle: {bAngle}</span>
          )}
        </div>

        {bError && (
          <p className="mt-2 rounded-xl bg-pink-1/10 p-2.5 text-[12px] text-pink-1">{bError}</p>
        )}

        {useB && (
          <div className="field fade-up mt-3 p-3">
            <div className="flex items-center justify-between">
              <span
                className="text-[11px] font-semibold"
                style={{ color: VARIANT_COLOR["variant-2"] }}
              >
                VARIANT B
              </span>
              <div className="flex items-center gap-2">
                <CharCount value={copyB} />
                <button
                  type="button"
                  onClick={() => {
                    setUseB(false);
                    setCopyB("");
                  }}
                  className="text-[11px] text-ink-3 hover:text-ink-1"
                >
                  Remove
                </button>
              </div>
            </div>
            <textarea
              value={copyB}
              onChange={(e) => setCopyB(e.target.value)}
              rows={5}
              placeholder="A second angle to test against the same audience…"
              className="mt-2 w-full resize-y bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-ink-3"
            />
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <Label>Context</Label>
          <span className="text-[11px] text-ink-3">optional, sharpens objections</span>
        </div>

        <div className="field mt-3 p-3">
          <textarea
            value={campaign.context}
            onChange={(e) => setCampaign({ ...campaign, context: e.target.value })}
            rows={3}
            maxLength={600}
            placeholder="What is it, who is it for, what does it cost? e.g. Email tool for wedding photographers. 49 EUR/mo, 14-day trial, no card."
            className="w-full resize-y bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-ink-3"
          />
        </div>

        <div className="mt-3">
          <div className="text-[11px] text-ink-2">What should this post achieve?</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GOALS.map((g) => {
              const active = campaign.goal === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  title={g.hint}
                  aria-pressed={active}
                  onClick={() => setCampaign({ ...campaign, goal: g.id })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-transparent bg-ink-1 text-white"
                      : "border-line-2 bg-paper text-ink-2 hover:border-line hover:text-ink-1"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={onRun}
        disabled={disabled}
        className="w-full rounded-full bg-ink-1 px-6 py-3 text-[14px] font-semibold text-white transition-opacity disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-blue-1 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {running ? "Simulating…" : "Run simulation"}
      </button>
      <p className="-mt-4 text-center text-[11px] text-ink-3">
        {audience.profiles.length} clones react · ⌘↵
      </p>
    </div>
  );
}

const ICP_EXAMPLE =
  "Freelance wedding photographers in Spain who book 20-30 weddings a year and get most leads from Instagram";

function IcpBuilder({
  onGenerate,
  generating,
  stage,
  error,
}: {
  onGenerate: (icp: string) => void;
  generating: boolean;
  stage: string;
  error: string;
}) {
  const [open, setOpen] = useState(false);
  const [icp, setIcp] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-2xl border border-dashed border-line px-3.5 py-2.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-blue-1 hover:text-blue-1"
      >
        + Build your own audience
      </button>
    );
  }

  return (
    <div className="field fade-up mt-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-violet-1">YOUR AUDIENCE</span>
        {!generating && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[11px] text-ink-3 hover:text-ink-1"
          >
            Cancel
          </button>
        )}
      </div>
      <textarea
        value={icp}
        onChange={(e) => setIcp(e.target.value)}
        rows={3}
        disabled={generating}
        placeholder={`Who are you posting to? e.g. ${ICP_EXAMPLE}`}
        className="mt-2 w-full resize-y bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-ink-3 disabled:opacity-50"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onGenerate(icp)}
          disabled={generating || icp.trim().length < 12}
          className="rounded-full bg-violet-1 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-30"
        >
          {generating ? "Building…" : "Build audience"}
        </button>
        {!generating && !icp.trim() && (
          <button
            type="button"
            onClick={() => setIcp(ICP_EXAMPLE)}
            className="text-[11px] text-ink-2 hover:text-ink-1"
          >
            Use an example
          </button>
        )}
      </div>
      {generating && stage && (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-1 pulse-dot" />
          {stage}
        </p>
      )}
      {error && (
        <p className="mt-2 rounded-xl bg-pink-1/10 p-2.5 text-[12px] text-pink-1">{error}</p>
      )}
    </div>
  );
}

function ImportBuilder({ onImport }: { onImport: (audience: Audience) => void }) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [error, setError] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-2xl border border-dashed border-line px-3.5 py-2.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-blue-1 hover:text-blue-1"
      >
        + Import a real audience from URL
      </button>
    );
  }

  return (
    <div className="field fade-up mt-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-violet-1">IMPORTED AUDIENCE</span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="text-[11px] text-ink-3 hover:text-ink-1"
        >
          Cancel
        </button>
      </div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={6}
        placeholder="Paste the audience JSON from work/audience-*.json"
        className="mt-2 w-full resize-y bg-transparent font-mono text-[11px] leading-relaxed outline-none placeholder:text-ink-3"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            try {
              onImport(parseImportedAudience(json));
              setOpen(false);
              setJson("");
              setError("");
            } catch (err) {
              setError(
                err instanceof ImportError
                  ? err.message
                  : "Could not import that audience.",
              );
            }
          }}
          disabled={!json.trim()}
          className="rounded-full bg-violet-1 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-30"
        >
          Import audience
        </button>
      </div>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-3">
        terminal: scripts/scrape-audience.sh --url https://… — then paste
        work/audience-*.json
      </p>
      {error && (
        <p className="mt-2 rounded-xl bg-pink-1/10 p-2.5 text-[12px] text-pink-1">{error}</p>
      )}
    </div>
  );
}
