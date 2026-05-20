#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

URL=$(aws lambda get-function-url-config --function-name edm-factoring-scorer --region us-east-1 --query FunctionUrl --output text)
echo "URL publica: $URL"
echo ""

echo "== 1. GET /health =="
curl -s --max-time 30 "${URL}health"; echo

echo ""
echo "== 2. Obtener relacion_id de Arrocera del Tolima =="
# Pull via curl direct a Supabase REST
RELACION_ID=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/proveedores?razon_social=ilike.*Arrocera%20del%20Tolima*&select=id" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])" 2>/dev/null)
echo "proveedor_id: $RELACION_ID"
REL=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/relaciones?proveedor_id=eq.$RELACION_ID&select=id" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])")
echo "relacion_id:  $REL"

echo ""
echo "== 3. POST /score =="
RESPONSE=$(curl -s --max-time 60 -X POST "${URL}score" \
    -H "content-type: application/json" \
    -d "{\"relacion_id\":\"$REL\"}")
echo "$RESPONSE" | python3 -m json.tool

echo ""
echo "== 4. POST /score-batch (test del batch endpoint) =="
# Tomar 3 relaciones
RELS=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/relaciones?select=id&limit=3" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps([{'relacion_id':r['id']} for r in d]))")
echo "Payload: $RELS"
curl -s --max-time 60 -X POST "${URL}score-batch" \
    -H "content-type: application/json" \
    -d "$RELS" | python3 -m json.tool | head -40

echo ""
echo "== TODO OK - Lambda URL publica funciona! =="
