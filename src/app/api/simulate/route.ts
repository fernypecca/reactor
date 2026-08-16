import { NextResponse } from "next/server";
import { AUDIENCES } from "@/lib/audiences";
import { simulateVariant } from "@/lib/simulate";
import { rewriteVariant } from "@/lib/rewrite";
import { buildVariantResult, pickBestVariant } from "@/lib/aggregate";
import type { SimulateInput, SimulationResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidInput(p: unknown): p is SimulateInput {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.audienceId === "string" &&
    Array.isArray(o.variants) &&
    o.variants.length >= 1 &&
    o.variants.length <= 2 &&
    o.variants.every((v) => typeof v === "string" && v.trim().length > 0)
  );
}

export async function POST(req: Request) {
  let input: SimulateInput;
  try {
    const body = await req.json();
    if (!isValidInput(body)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    input = {
      audienceId: body.audienceId,
      variants: body.variants.map((v: string) => v.trim()),
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const audience = AUDIENCES.find((a) => a.id === input.audienceId);
  if (!audience) {
    return NextResponse.json({ error: "Unknown audience" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + "\n"));
        } catch {
          /* stream closed */
        }
      };
      try {
        const variantIds = input.variants.map((_, i) => `variant-${i + 1}`);

        const variantResults = await Promise.all(
          input.variants.map(async (copy, i) => {
            const variantId = variantIds[i];
            send("variant_start", { variantId, copy });
            const reactions: Awaited<ReturnType<typeof simulateVariant>> = [];
            await simulateVariant(audience.profiles, copy, (batch) => {
              reactions.push(...batch);
              send("reactions", { variantId, reactions: batch });
            });
            const result = buildVariantResult(variantId, copy, reactions);
            send("variant_done", { variantId, avgScore: result.avgScore });
            return result;
          }),
        );

        const { rewrite, why } = await rewriteVariant(variantResults);

        const result: SimulationResult = {
          audienceId: input.audienceId,
          variants: variantResults,
          bestVariantId: pickBestVariant(variantResults),
          rewrite,
        };

        send("results", result);
        send("rewrite", { rewrite, why });
        send("done", { ok: true });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}