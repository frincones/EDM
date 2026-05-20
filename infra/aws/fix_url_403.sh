#!/usr/bin/env bash
# Fix definitivo para el 403 de Function URL (cambio AWS octubre 2025):
# Necesitamos BOTH lambda:InvokeFunctionUrl AND lambda:InvokeFunction
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

FN=edm-factoring-scorer
REGION=us-east-1

echo "== 1. Limpiar permisos viejos =="
for sid in FunctionURLAllowPublicAccess UrlPolicyInvokeFunction UrlPolicyInvokeFunctionUrl; do
    aws lambda remove-permission --function-name $FN --statement-id $sid --region $REGION 2>&1 || true
done

echo ""
echo "== 2. Agregar lambda:InvokeFunctionUrl (Principal: *, auth NONE) =="
aws lambda add-permission \
    --function-name $FN \
    --statement-id UrlPolicyInvokeFunctionUrl \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region $REGION

echo ""
echo "== 3. NUEVO: lambda:InvokeFunction (sin function-url-auth-type) =="
aws lambda add-permission \
    --function-name $FN \
    --statement-id UrlPolicyInvokeFunction \
    --action lambda:InvokeFunction \
    --principal "*" \
    --region $REGION

echo ""
echo "== 4. Verificar policy final =="
aws lambda get-policy --function-name $FN --region $REGION --query 'Policy' --output text | python3 -m json.tool

echo ""
echo "== 5. Wait 10s for propagation =="
sleep 10

echo ""
echo "== 6. Test publico =="
URL=$(aws lambda get-function-url-config --function-name $FN --region $REGION --query FunctionUrl --output text)
echo "URL: $URL"
echo ""
echo "GET /health:"
curl -s --max-time 90 "${URL}health"
echo ""
echo ""
echo "POST /score (Arrocera del Tolima):"
# Pull relacion_id de Arrocera
RELACION_ID=$(curl -s -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/proveedores?razon_social=ilike.*Arrocera%20del%20Tolima*&select=id" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")
if [ -n "$RELACION_ID" ]; then
    REL=$(curl -s -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/relaciones?proveedor_id=eq.$RELACION_ID&select=id" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")
    echo "relacion_id: $REL"
    curl -s --max-time 60 -X POST "${URL}score" \
        -H "content-type: application/json" \
        -d "{\"relacion_id\":\"$REL\"}"
fi
echo ""
echo "$URL" > .lambda-url.txt
