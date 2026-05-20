#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

URL="${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest"
EVENT_ID="evt-test-$(date +%s)"

echo "== POST /ingest =="
echo "URL: $URL"

# Necesitamos un relacion_id existente
REL=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/relaciones?select=id,proveedor_id,comprador_id&limit=1" \
    | python3 -c "import sys,json; r=json.load(sys.stdin)[0]; print(f\"{r['id']}|{r['proveedor_id']}|{r['comprador_id']}\")")
REL_ID=$(echo $REL | cut -d'|' -f1)
PROV_ID=$(echo $REL | cut -d'|' -f2)
COMP_ID=$(echo $REL | cut -d'|' -f3)
echo "Test usara: relacion=$REL_ID"

# Cuenta de facturas antes
BEFORE=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Prefer: count=exact" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/facturas?select=id" -I 2>&1 | grep -i "content-range" | tail -1)
echo "Facturas antes: $BEFORE"

cat > /tmp/event.json <<EOF
{
  "event_id": "$EVENT_ID",
  "event_type": "factura_emitida",
  "occurred_at": "2026-05-19T12:00:00Z",
  "payload": {
    "external_id": "FE-TEST-$(date +%s)",
    "relacion_id": "$REL_ID",
    "proveedor_id": "$PROV_ID",
    "comprador_id": "$COMP_ID",
    "monto_bruto_centavos": 1190000000,
    "impuestos_centavos": 190000000,
    "monto_neto_centavos": 1000000000,
    "moneda": "COP",
    "fecha_emision": "2026-05-19",
    "fecha_vencimiento": "2026-06-18"
  }
}
EOF

echo ""
echo "== Sending event =="
RESP=$(curl -s -X POST "$URL" \
    -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    -H "content-type: application/json" \
    -d @/tmp/event.json)
echo "Response: $RESP"

echo ""
echo "== Verify eventos_raw =="
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/eventos_raw?event_id=eq.$EVENT_ID&select=event_id,event_type,source,received_at" | python3 -m json.tool

echo ""
echo "== Cleanup =="
curl -s -X DELETE -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/eventos_raw?event_id=eq.$EVENT_ID"
curl -s -X DELETE -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/facturas?external_id=like.FE-TEST-*"
echo "  cleanup ok"
