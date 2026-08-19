import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ModelTier = "fast" | "smart";

/** True when a model is configured — callers with a deterministic fallback skip the failed attempts when this is false. */
export function hasModel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function resolveModel(tier: ModelTier): string {
  if (tier === "fast") {
    return process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-4-5";
  }
  return process.env.ANTHROPIC_SMART_MODEL || "claude-sonnet-4-5";
}

export type CompleteOptions = {
  system: string;
  prompt: string;
  tier?: ModelTier;
  maxTokens?: number;
  json?: boolean;
};

const QUALITY_BAR = `You write like a senior B2B growth operator, not a marketing intern.
Concrete numbers, specific claims, zero fluff, zero clichés. No placeholders like [Name] or [Company].
Never wrap the response in markdown fences. Never add prose outside the requested format.`;

export async function complete<T = string>(opts: CompleteOptions): Promise<T> {
  const system = opts.json
    ? `${QUALITY_BAR}\n\n${opts.system}\n\nCRITICAL: Respond with ONLY valid JSON. No markdown fences, no prose, no trailing commas.`
    : `${QUALITY_BAR}\n\n${opts.system}`;

  const msg = await anthropic.messages.create({
    model: resolveModel(opts.tier ?? "smart"),
    max_tokens: opts.maxTokens ?? 2048,
    system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  if (!opts.json) return text as T;
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

export type Validate<T> = (value: unknown) => value is T;

/**
 * Ask the LLM for JSON, validate it, and retry once on invalid JSON or
 * schema mismatch before escalating the model tier.
 */
export async function completeJSON<T>(
  opts: CompleteOptions,
  validate: Validate<T>,
): Promise<T> {
  const base = opts.tier ?? "smart";
  const attempts: { tier: ModelTier; label: string }[] = [
    { tier: base, label: "initial" },
    { tier: base, label: "retry" },
    { tier: "smart", label: "escalated" },
  ];

  for (const attempt of attempts) {
    try {
      const raw = await complete<T>({ ...opts, tier: attempt.tier, json: true });
      if (validate(raw)) return raw;
      console.warn(`[completeJSON] schema mismatch (${attempt.label}), retrying`);
    } catch (err) {
      console.warn(`[completeJSON] ${attempt.label} failed:`, err);
    }
  }

  throw new Error(
    `[completeJSON] failed after ${attempts.length} attempts for: ${opts.prompt.slice(0, 120)}`,
  );
}
