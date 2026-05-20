#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

export PATH="$HOME/.local/share/supabase:$HOME/.local/bin:$PATH"
PROJECT_REF="${SUPABASE_PROJECT_REF}"
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN}"

echo "== Supabase CLI version =="
supabase --version

# Init local config si no existe
if [ ! -f supabase/config.toml ]; then
    echo ""
    echo "== Init local supabase config =="
    yes Y | supabase init || true
fi

echo ""
echo "== Copiar Edge Function ingest =="
mkdir -p supabase/functions/ingest
cp infra/supabase/functions/ingest/index.ts supabase/functions/ingest/index.ts
echo "  ok"

echo ""
echo "== Link al proyecto $PROJECT_REF =="
supabase link --project-ref "$PROJECT_REF" 2>&1 | tail -5 || true

echo ""
echo "== Deploy Edge Function ingest =="
supabase functions deploy ingest --no-verify-jwt --project-ref "$PROJECT_REF" 2>&1 | tail -15

echo ""
echo "== Listar functions =="
supabase functions list --project-ref "$PROJECT_REF" 2>&1
