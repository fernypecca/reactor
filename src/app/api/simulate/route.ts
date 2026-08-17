import { NextResponse } from "next/server";
import { AUDIENCES } from "@/lib/audiences";
import { simulateVariant } from "@/lib/simulate";
import { rewriteVariant } from "@/lib/rewrite";
import { buildVariantResult, pickBestVariant } from "@/lib/aggregate";
import { sanitizeProfiles } from "@/lib/audience-schema";
import { sanitizeCampaign, type Campaign } from "@/lib/campaign";
import type { FollowerProfile, SimulateInput, SimulationResult } from "@/lib/types";

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
  let profiles: FollowerProfile[];
  let campaign: Campaign;
  try {
    const body = await req.json();
    if (!isValidInput(body)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    input = {
      audienceId: body.audienceId,
      variants: body.variants.map((v: string) => v.trim()),
    };

    campaign = sanitizeCampaign((body as Record<string, unknown>).campaign);

    // Audiences generated from an ICP only exist in the browser, so the client
    // sends the profiles along. Everything in them is untrusted.
    const inlineProfiles = (body as Record<string, unknown>).profiles;
    if (inlineProfiles !== undefined) {
      const result = sanitizeProfiles(inlineProfiles);
      if (!result.ok) {
        return NextResponse.json(
          { error: `Invalid audience profiles (${result.error})` },
          { status: 400 },
        );
      }
      profiles = result.profiles;
    } else {
      const audience = AUDIENCES.find((a) => a.id === input.audienceId);
      if (!audience) {
        return NextResponse.json({ error: "Unknown audience" }, { status: 404 });
      }
      profiles = audience.profiles;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
            await simulateVariant(
              profiles,
              copy,
              (batch) => {
                reactions.push(...batch);
                send("reactions", { variantId, reactions: batch });
              },
              campaign,
            );
            const result = buildVariantResult(variantId, copy, reactions);
            send("variant_done", { variantId, avgScore: result.avgScore });
            return result;
          }),
        );

        const rewriteResult = await rewriteVariant(variantResults, campaign);

        const result: SimulationResult = {
          audienceId: input.audienceId,
          variants: variantResults,
          bestVariantId: pickBestVariant(variantResults),
          rewrite: rewriteResult.rewrite,
        };

        send("results", result);
        send("rewrite", rewriteResult);
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