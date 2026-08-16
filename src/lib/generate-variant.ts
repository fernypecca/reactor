import { completeJSON } from "./llm";

type VariantPayload = { variant: string; angle: string };

function isVariantPayload(v: unknown): v is VariantPayload {
  const o = v as Partial<VariantPayload> | null;
  return (
    !!o &&
    typeof o.variant === "string" &&
    o.variant.trim().length > 0 &&
    typeof o.angle === "string"
  );
}

const GENERATE_SYSTEM = `You are a launch copywriter. Rewrite the creator's launch copy as a SECOND VARIANT using a different psychological angle than the original (pain-first, loss aversion/urgency, or direct benefit). Keep the creator's voice, keep a similar length. No hype words, no placeholders, no invented facts.
Respond with ONLY valid JSON: {"variant": string, "angle": string}`;

export function fallbackVariant(copy: string): { variant: string; angle: string } {
  const trimmed = copy.trim();
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  const hook = sentences[0] ?? trimmed;
  const body = sentences.slice(1).join(" ") || trimmed;
  const packed = body.length > 160 ? body.slice(0, 160).trimEnd() + "…" : body;
  return {
    angle: "Direct & benefit-first",
    variant: `${hook} ${packed}`.slice(0, 240),
  };
}

export async function generateVariant(
  copy: string,
): Promise<{ variant: string; angle: string }> {
  const trimmed = copy.trim();
  const fallback = fallbackVariant(trimmed);
  try {
    const result = await completeJSON<VariantPayload>(
      {
        system: GENERATE_SYSTEM,
        prompt: `ORIGINAL COPY:\n"""\n${trimmed}\n"""\n\nWrite the second variant.`,
        tier: "smart",
        maxTokens: 400,
      },
      isVariantPayload,
    );
    if (!result.variant.trim()) return fallback;
    return { variant: result.variant, angle: result.angle };
  } catch (err) {
    console.warn("[generate-variant] failed, using fallback:", err);
    return fallback;
  }
}