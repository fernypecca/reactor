# Reactor

Pre-launch your post against a simulated audience before you publish.

Three demo audiences (Indie Hackers, SaaS Founders, AI Enthusiasts) are cloned
from bios, interests and engagement styles. Paste your launch copy, add a second
variant, and watch the room turn one clone at a time — then see exactly who
moved between the two.

## Quick start

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Without a key the app still works: reactions, scores, clustering and the whole
comparison run on a deterministic engine. Only the copywriting steps (variant B
and the rewrite) need a model, and the UI says so instead of pretending.

## Audiences

Three demo audiences ship hand-written. You can also describe your own —
"freelance wedding photographers in Spain who book 20-30 weddings a year" —
and Reactor splits it into 3 segments that would react *differently* to the
same post, then writes 26 followers across them. Generated audiences live in
your browser (`localStorage`) and are sent with the simulate request; nothing
is stored server-side.

Every generated follower is fictional by construction — the prompt forbids
real names and handles, because these profiles get put in someone's mouth.
This step needs `ANTHROPIC_API_KEY`; there is no deterministic stand-in for
writing 26 distinct people, so it says so instead of faking it.

You can also **clone an audience from a real page** — a community, directory,
marketplace or blog you're about to post in. `scripts/scrape-audience.sh`
scrapes the page with the local Orpheus scraper first (Firecrawl only as a
fallback), has a model write followers grounded in the people, language and
objections the page actually shows, and saves an `Audience` JSON. Import it in
the UI (Audience → *Import a real audience from URL*) and it joins the picker
like any generated audience:

```bash
scripts/scrape-audience.sh --url "https://…"        # writes work/audience-*.json
```

The imported JSON goes through the same sanitizers as everything else that
reaches the simulate prompt (`src/lib/audience-schema.ts`); nothing is stored
server-side. Requires `ANTHROPIC_API_KEY`, and the local scraper at
`~/.claude/scripts/orpheus.sh`.

## The interface

- **Audience field** — a force-directed constellation of every follower,
  clustered by segment, linked by shared interests. Nodes light up as their
  reaction streams in; colour is the score band, the solid core is intensity.
  Hover any node for that follower's bio, score and verbatim reaction.
- **Δ Compare** — paints each node by how far it moved between variant A and B.
  Two variants can tie on average while a third of the audience quietly swaps
  sides; this is where you see it.
- **Score trajectory** — every clone as a tick, the running average as a line,
  pinned to a 0–100 axis so two runs are always comparable.
- **Score by segment / What stops them** — hover a segment or click an objection
  theme to isolate those followers in the field and in the feed at once.
- **Verdict** — refuses to crown a winner when the gap between variants is
  inside the noise floor (see `src/lib/verdict.ts`).

## The reveal

Both variants are fetched in parallel, but nothing the server sends reaches the
screen directly. `src/lib/pacer.ts` buffers every event and releases it on a
clock: variant A fills the field one follower at a time, then B, then the
verdict lands. It runs about 20 seconds regardless of how fast the model
answers, the counters ease toward their new totals instead of jumping, and the
graph follows whichever variant is currently being revealed.

Hit **Skip** to dump the rest of the queue on screen at once. Under
`prefers-reduced-motion` the pacing is bypassed entirely.

## How it works

- `/api/simulate` streams NDJSON events: `variant_start` → `reactions`
  (one per batch) → `variant_done` → `results` → `rewrite` → `done`.
- Followers are batched into groups of 10 per LLM call; both variants run in
  parallel.
- Everything that turns reactions into insight — layout, aggregation, score
  bands, filters, verdict — is pure, framework-free and unit-tested.

## Env vars

| Var | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | no | LLM reactions and rewrites (falls back otherwise) |
| `ANTHROPIC_FAST_MODEL` | no | default `claude-haiku-4-5` |
| `ANTHROPIC_SMART_MODEL` | no | default `claude-sonnet-4-5` |
| `FIRECRAWL_API_KEY` | no | fallback scraper when Orpheus is blocked |

## Tests

```bash
npm test
```

## Deploy

Push to GitHub → import in Vercel → add `ANTHROPIC_API_KEY` → deploy.
