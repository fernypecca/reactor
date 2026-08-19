#!/usr/bin/env bash
# scrape-audience.sh — clona una audiencia real desde una página y la deja lista
# para importar en Reactor (Audience → Importar audiencia real).
#
# Orpheus (scraper local, $0) es la PRIMERA opción; si lo bloquean cae a Firecrawl
# solo si FIRECRAWL_API_KEY está definida; si no, falla con el motivo.
#
# Uso:
#   scripts/scrape-audience.sh --url https://... [--count 26] [--description "..."] \
#       [--out work/audience-x.json] [--max-chars 12000]
#
# Requiere ANTHROPIC_API_KEY (lee .env.local / .env). Salida: Audience JSON válido
# para el importador de Reactor.
set -euo pipefail

cd "$(dirname "$0")/.."

URL=""
COUNT=26
DESCRIPTION=""
OUT=""
MAX_CHARS=12000
ORPHEUS_SH="${ORPHEUS_SH:-$HOME/.claude/scripts/orpheus.sh}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --count) COUNT="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --max-chars) MAX_CHARS="$2"; shift 2 ;;
    -h|--help)
      awk 'NR > 1 && /^#/ { print substr($0, 3) } NR > 1 && !/^#/ { exit }' "$0"
      exit 0 ;;
    *) echo "scrape-audience.sh: flag desconocida $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$URL" ]]; then
  echo "scrape-audience.sh: falta --url" >&2
  exit 2
fi

# cargar .env.local / .env si existen (sin pisar env ya exportado)
for envfile in .env.local .env; do
  if [[ -f "$envfile" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$envfile"
    set +a
  fi
done

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "scrape-audience.sh: falta ANTHROPIC_API_KEY (ponla en .env.local)" >&2
  exit 1
fi

if [[ ! -x "$ORPHEUS_SH" ]]; then
  echo "scrape-audience.sh: no existe $ORPHEUS_SH (configura ORPHEUS_SH o instala orpheus.sh)" >&2
  exit 1
fi

SLUG="$(node -e '
const u = new URL(process.argv[1]);
const base = u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
process.stdout.write((base.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60)) || "imported");
' "$URL")"

OUT="${OUT:-work/audience-${SLUG}.json}"
mkdir -p "$(dirname "$OUT")"

SCRAPE_TMP="$(mktemp "${TMPDIR:-/tmp}/reactor-scrape-XXXXXX.txt")"
cleanup() { rm -f "$SCRAPE_TMP" "$SCRAPE_TMP.err" "$SCRAPE_TMP.json"; }
trap cleanup EXIT

# Ruta 1: Orpheus (scraper local, $0)
if "$ORPHEUS_SH" "$URL" --max-chars "$MAX_CHARS" > "$SCRAPE_TMP" 2>"$SCRAPE_TMP.err"; then
  :
else
  ERRMSG="$(head -c 300 "$SCRAPE_TMP.err" 2>/dev/null | tr '\n' ' ')"
  echo "scrape-audience.sh: Orpheus no pudo leer $URL → $ERRMSG" >&2
  if [[ -n "${FIRECRAWL_API_KEY:-}" ]]; then
    echo "scrape-audience.sh: intentando Firecrawl…" >&2
    BODY="$(node -e 'process.stdout.write(JSON.stringify({url: process.argv[1], formats: ["markdown"], onlyMainContent: true}))' "$URL")"
    if curl -sS --max-time 60 -X POST "https://api.firecrawl.dev/v1/scrape" \
        -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$BODY" -o "$SCRAPE_TMP.json"; then
      node -e '
        const fs = require("fs");
        try {
          const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
          const md = (j.data && (j.data.markdown || j.data.content)) || "";
          if (md.trim()) { fs.writeFileSync(process.argv[2], md); process.exit(0); }
          process.exit(1);
        } catch { process.exit(1); }
      ' "$SCRAPE_TMP.json" "$SCRAPE_TMP" || {
        echo "scrape-audience.sh: Firecrawl devolvió vacío/error" >&2
        exit 1
      }
    else
      echo "scrape-audience.sh: Firecrawl falló (HTTP o timeout)" >&2
      exit 1
    fi
  else
    echo "scrape-audience.sh: define FIRECRAWL_API_KEY para el fallback, o prueba otra URL." >&2
    exit 1
  fi
fi

if [[ ! -s "$SCRAPE_TMP" ]]; then
  echo "scrape-audience.sh: texto vacío tras el scrape. Nada que clonar." >&2
  exit 1
fi

echo "scrape-audience.sh: scrape OK ($(wc -c < "$SCRAPE_TMP" | tr -d ' ') bytes), generando audiencia con la LLM…" >&2

COUNT="$COUNT" \
DESCRIPTION="$DESCRIPTION" \
AUDIENCE_ID="$SLUG" \
AUDIENCE_NAME="${DESCRIPTION:-$SLUG}" \
node scripts/generate-audience.mjs < "$SCRAPE_TMP" > "$OUT" 2>"$OUT.err" || {
  cat "$OUT.err" >&2
  rm -f "$OUT.err"
  exit 1
}
rm -f "$OUT.err"

node -e '
const fs = require("fs");
const a = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const bySeg = {};
for (const p of a.profiles) bySeg[p.segment] = (bySeg[p.segment] || 0) + 1;
console.log(`  audiencia: ${a.name}`);
console.log(`  segmentos: ${a.segments.map((s) => s.label).join(" / ")}`);
console.log(`  perfiles:  ${a.profiles.length} (${Object.entries(bySeg).map(([k, v]) => `${k}: ${v}`).join(", ")})`);
console.log(`  guardada en: ${process.argv[1]}`);
' "$OUT"

echo "Pégalo en Reactor → Audience → Importar audiencia real."