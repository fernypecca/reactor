import { NextResponse } from "next/server";
import {
  DEFAULT_SPLIT,
  assembleAudience,
  generateSegmentFollowers,
  generateStructure,
  splitCount,
} from "@/lib/generate-audience";
import { slugify } from "@/lib/audience-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_ICP = 12;
const MAX_ICP = 600;
const TARGET_HEADCOUNT = DEFAULT_SPLIT.reduce((a, b) => a + b, 0);

export async function POST(req: Request) {
  // Unlike scoring, there is no sensible deterministic stand-in for writing 26
  // distinct people. Fail here with something actionable rather than 40s later.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Building an audience needs a model. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  let icp: string;
  try {
    const body = await req.json();
    const raw = (body as Record<string, unknown>)?.icp;
    if (typeof raw !== "string" || raw.trim().length < MIN_ICP) {
      return NextResponse.json(
        { error: `Describe the audience in at least ${MIN_ICP} characters.` },
        { status: 400 },
      );
    }
    icp = raw.trim().slice(0, MAX_ICP);
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
        send("stage", { label: "Splitting the audience into segments…" });
        const brief = await generateStructure(icp);
        send("brief", brief);

        const counts = splitCount(TARGET_HEADCOUNT, brief.segments.length);

        // segments are independent, so write them all at once
        const bySegment = await Promise.all(
          brief.segments.map(async (segment, i) => {
            send("stage", { label: `Writing the ${segment.label} segment…` });
            const followers = await generateSegmentFollowers(icp, brief, segment, counts[i]);
            send("segment_done", { id: segment.id, label: segment.label, count: followers.length });
            return { segment, followers };
          }),
        );

        const audienceId = `custom-${slugify(brief.name, "audience")}-${Date.now().toString(36)}`;
        const audience = assembleAudience(audienceId, brief, bySegment);

        send("audience", audience);
        send("done", { ok: true });
      } catch (err) {
        // the raw error carries the prompt; that belongs in the log, not the UI
        console.error("[generate-audience] failed:", err);
        send("error", {
          message:
            "The model could not produce a usable audience. Try describing the group in one plain sentence — who they are and what they care about.",
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
