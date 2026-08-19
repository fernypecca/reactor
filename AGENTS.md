<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Scraping: Orpheus first, Firecrawl fallback

Si alguna vez se extrae texto de páginas web, **Orpheus** (scraper local, gratis) es la PRIMERA opción; Firecrawl solo si Orpheus no accede. Shell: `~/.claude/scripts/orpheus.sh <url> [--max-chars N]` (exit 0 + texto en stdout; exit 1 = bloqueado → caer a Firecrawl).

Para clonar una audiencia real en Reactor desde una página: `scripts/scrape-audience.sh --url <url>` → Orpheus → LLM → `work/audience-<slug>.json`, importable en el UI (Audience → Importar audiencia real).