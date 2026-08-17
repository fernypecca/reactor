import { completeJSON } from "./llm";
import { pickBestVariant } from "./aggregate";
import type { RewriteResult, VariantResult } from "./types";

type RewritePayload = { rewrite: string; why: string };

function isRewritePayload(v: unknown): v is RewritePayload {
  const o = v as Partial<RewritePayload> | null;
  return (
    !!o &&
    typeof o.rewrite === "string" &&
    o.rewrite.trim().length > 0 &&
    typeof o.why === "string"
  );
}

const REWRITE_SYSTEM = `You are a conversion copywriter. Given two variants of a launch post and how a simulated audience reacted to each, write ONE improved version that keeps the best elements and neutralizes the top objection. Keep the creator's voice. No hype words. No placeholders.
Respond with ONLY valid JSON: {"rewrite": string, "why": string}`;

export async function rewriteVariant(variants: VariantResult[]): Promise<RewriteResult> {
  if (variants.length === 0) {
    return { rewrite: "", why: "No variants to rewrite.", source: "fallback" };
  }

  const best = pickBestVariant(variants);
  const bestVariant = variants.find((v) => v.variantId === best) ?? variants[0];
  const fallback: RewriteResult = {
    rewrite: bestVariant.copy,
    why: "Highest simulated engagement of the tested variants.",
    source: "fallback",
  };

  const prompt = variants
    .map(
      (v) =>
        `VARIANT ${v.variantId} (avg score ${v.avgScore}):\n"""\n${v.copy}\n"""\nTop objections: ${
          v.objectionClusters.length
            ? v.objectionClusters.map((c) => `${c.objection} (${c.count})`).join(", ")
            : "none"
        }`,
    )
    .join("\n\n");

  try {
    const result = await completeJSON<RewritePayload>(
      { system: REWRITE_SYSTEM, prompt, tier: "smart", maxTokens: 600 },
      isRewritePayload,
    );
    if (!isRewritePayload(result)) return fallback;
    return { ...result, source: "llm" };
  } catch (err) {
    console.warn("[rewrite] failed, using best variant:", err);
    return fallback;
  }
}