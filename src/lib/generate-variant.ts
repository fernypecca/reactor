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

/** density of digits in a sentence — a cheap proxy for "this is the proof" */
function proofScore(sentence: string): number {
  const digits = (sentence.match(/\d/g) ?? []).length;
  const percents = (sentence.match(/[%$€]/g) ?? []).length;
  return digits + percents * 2;
}

/**
 * Used whenever the LLM is unavailable. It must produce a genuinely different
 * angle from the original — otherwise A and B are the same post and the whole
 * comparison is meaningless. So it restructures rather than paraphrases:
 * the hardest evidence leads, the promise follows. No word is invented.
 */
export function fallbackVariant(copy: string): { variant: string; angle: string } {
  const trimmed = copy.trim();
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);

  if (sentences.length < 2) {
    return { angle: "Proof-first", variant: trimmed.slice(0, 240) };
  }

  let proofIndex = 0;
  let bestScore = -1;
  sentences.forEach((s, i) => {
    const score = proofScore(s);
    // ties go to the later sentence: the payoff usually sits near the end
    if (score >= bestScore && score > 0) {
      bestScore = score;
      proofIndex = i;
    }
  });

  // no numbers anywhere — lead with the closing line instead of the opener
  if (bestScore <= 0) proofIndex = sentences.length - 1;

  const lead = sentences[proofIndex];
  const rest = sentences.filter((_, i) => i !== proofIndex);
  const variant = [lead, ...rest].join(" ").trim();

  return {
    angle: bestScore > 0 ? "Proof-first" : "Outcome-first",
    variant: variant.length > 240 ? variant.slice(0, 239).trimEnd() + "…" : variant,
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