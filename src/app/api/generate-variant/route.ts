import { NextResponse } from "next/server";
import { generateVariant } from "@/lib/generate-variant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const copy = typeof body?.copy === "string" ? body.copy.trim() : "";
    if (copy.length < 10) {
      return NextResponse.json({ error: "Copy too short" }, { status: 400 });
    }
    const result = await generateVariant(copy);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}