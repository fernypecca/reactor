# Reactor

Pre-launch your post against a simulated audience before you publish.
Three demo audiences (Indie Hackers, SaaS Founders, AI Enthusiasts) are
cloned from bios, interests and engagement styles. Paste your launch copy
(up to 2 variants), watch clones react with scores and objections, and get
a rewrite that neutralizes the top objection.

## Quick start

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Without a key the app still works: it falls back to deterministic
simulated reactions.

## How it works

- `/api/simulate` streams NDJSON events: `variant_start` → `reactions`
  (one per batch) → `variant_done` → `results` → `rewrite` → `done`.
- 30 followers per audience, batched into groups of 10 per LLM call.
- Pure aggregation (scores, objection clusters, segment averages) is
  framework-free and unit-tested.

## Env vars

| Var | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | no | LLM reactions (falls back otherwise) |
| `ANTHROPIC_FAST_MODEL` | no | default `claude-haiku-4-5` |
| `ANTHROPIC_SMART_MODEL` | no | default `claude-sonnet-4-5` |

## Tests

```bash
npm test
```

## Deploy

Push to GitHub → import in Vercel → add `ANTHROPIC_API_KEY` → deploy.