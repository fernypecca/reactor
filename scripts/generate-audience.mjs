#!/usr/bin/env node
// generate-audience.mjs — convierte el texto scrapeado de una página real en una
// audiencia clonada con el mismo shape que src/lib/types.ts (Audience).
//
// Solo LLM: no hay sustituto determinista para escribir N personas distintas, así
// que falla con mensaje claro si falta la clave o el JSON devuelto no es válido.
//
// Entrada: texto limpio por stdin. Env: COUNT, DESCRIPTION, AUDIENCE_ID, AUDIENCE_NAME,
// ANTHROPIC_API_KEY (obligatorio), ANTHROPIC_SMART_MODEL (opcional).
// Salida: Audience JSON por stdout.

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

const COUNT = Math.max(6, Math.min(60, parseInt(process.env.COUNT || "26", 10) || 26));
const DESCRIPTION = (process.env.DESCRIPTION || "").trim();
const AUDIENCE_ID = (process.env.AUDIENCE_ID || "imported").trim();
const AUDIENCE_NAME = (process.env.AUDIENCE_NAME || AUDIENCE_ID).trim();
const MODEL = process.env.ANTHROPIC_SMART_MODEL || "claude-sonnet-4-5";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const text = readFileSync(0, "utf8").trim();

if (!API_KEY) {
  process.stderr.write("generate-audience.mjs: falta ANTHROPIC_API_KEY\n");
  process.exit(1);
}
if (!text) {
  process.stderr.write("generate-audience.mjs: no hay texto en stdin (scrape vacío o bloqueado)\n");
  process.exit(1);
}

const TONES = ["cheerleader", "skeptic", "numbers", "questioner"];
const ENGAGEMENTS = ["short", "thread", "meme"];

function isRecord(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function validProfile(p) {
  return (
    isRecord(p) &&
    typeof p.id === "string" &&
    p.id.trim() &&
    typeof p.name === "string" &&
    p.name.trim() &&
    typeof p.handle === "string" &&
    p.handle.trim() &&
    typeof p.bio === "string" &&
    p.bio.trim() &&
    typeof p.segment === "string" &&
    p.segment.trim() &&
    Array.isArray(p.interests) &&
    p.interests.every((i) => typeof i === "string" && i.trim()) &&
    TONES.includes(p.tone) &&
    ENGAGEMENTS.includes(p.engagement) &&
    typeof p.objection === "string"
  );
}

function audienceError(v) {
  if (!isRecord(v)) return "no es un objeto";
  if (typeof v.id !== "string" || !v.id.trim()) return "id inválido";
  if (typeof v.name !== "string" || !v.name.trim()) return "name inválido";
  if (typeof v.description !== "string" || !v.description.trim()) return "description inválida";
  if (!Array.isArray(v.segments) || v.segments.length < 2) return "hacen falta >= 2 segmentos";
  if (!Array.isArray(v.profiles) || v.profiles.length < COUNT) return `se esperaban >= ${COUNT} perfiles, llegaron ${Array.isArray(v.profiles) ? v.profiles.length : "0"}`;
  if (!v.segments.every((s) => isRecord(s) && typeof s.id === "string" && s.id.trim() && typeof s.label === "string" && s.label.trim())) {
    return "segmentos con id/label inválidos";
  }
  if (!v.profiles.every(validProfile)) return "perfil con campos inválidos (tone/engagement/interests/…)";
  const ids = new Set(v.segments.map((s) => s.id));
  if (!v.profiles.every((p) => ids.has(p.segment))) return "hay perfiles apuntando a segmentos no declarados";
  return null;
}

const SYSTEM = `You are a growth-marketing audience researcher. You are given the scraped text of a real page (a community, directory, marketplace, blog or landing page) plus a short audience description.
Build a simulated follower audience whose personas are grounded in what the page actually shows: the people it describes, the language they use, the objections that surface in it.
Output the audience in EXACTLY this shape:
{"id": string, "name": string, "description": string, "segments": [{"id": string, "label": string}], "profiles": [{"id": string, "name": string, "handle": string, "bio": string, "interests": [string], "tone": "cheerleader"|"skeptic"|"numbers"|"questioner", "engagement": "short"|"thread"|"meme", "objection": string, "segment": string}]}
Rules:
- Exactly 3 segments that would react DIFFERENTLY to the same post. Every profile's "segment" must equal one of the segment ids.
- Exactly ${COUNT} profiles spread across the segments.
- Every profile is fictional: invent names and handles. Never reuse real names, real handles or real people found on the page — these profiles get put in someone's mouth.
- Ground bios, interests and objections in what the page shows. Specific beats vague.
- "tone" is how they engage: cheerleader, skeptic, numbers, questioner. "engagement" is reply length: short, thread, meme.
- "objection" is a one-line concern from that follower's point of view, or "" if they would engage without raising one.
- No hype words, no placeholders, no invented facts about products.
Respond with ONLY valid JSON. No markdown fences, no prose.`;

function cleanJson(raw) {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function ask() {
  const anthropic = new Anthropic({ apiKey: API_KEY });
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 5000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `PAGE TEXT:\n"""\n${text.slice(0, 20000)}\n"""\n\nAUDIENCE DESCRIPTION:\n${DESCRIPTION || "(none given)"}\n\nBuild the audience.`,
      },
    ],
  });
  const out = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(cleanJson(out));
}

let audience;
try {
  audience = await ask();
  const err = audienceError(audience);
  if (err) {
    process.stderr.write(`generate-audience.mjs: JSON inválido (${err}), reintentando…\n`);
    audience = await ask();
    const err2 = audienceError(audience);
    if (err2) {
      process.stderr.write(`generate-audience.mjs: JSON inválido tras reintento (${err2})\n`);
      process.exit(1);
    }
  }
} catch (e) {
  process.stderr.write(`generate-audience.mjs: falló la generación: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
}

audience.id = AUDIENCE_ID;
audience.name = AUDIENCE_NAME;
process.stdout.write(JSON.stringify(audience, null, 2) + "\n");