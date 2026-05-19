#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

REGION=us-east-1
FN=edm-factoring-scorer

echo "== Delete existing Function URL =="
aws lambda delete-function-url-config --function-name $FN --region $REGION 2>&1 || echo "  (no existia)"

echo ""
echo "== Remove old resource permission =="
aws lambda remove-permission --function-name $FN --statement-id FunctionURLAllowPublicAccess --region $REGION 2>&1 || echo "  (no permission)"

echo ""
echo "== Re-create Function URL =="
aws lambda create-function-url-config \
    --function-name $FN \
    --auth-type NONE \
    --region $REGION \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"],"MaxAge":3600}'

echo ""
echo "== Add public invoke permission =="
aws lambda add-permission \
    --function-name $FN \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region $REGION

echo ""
echo "== Verify =="
URL=$(aws lambda get-function-url-config --function-name $FN --region $REGION --query FunctionUrl --output text)
echo "URL: $URL"

echo ""
echo "== Wait 15s for propagation =="
sleep 15

echo ""
echo "== Test =="
curl -sv --max-time 60 "${URL}health" 2>&1 | grep -E "^(HTTP|<|Function|status|model|x-amzn)" | head -10
echo ""
echo "Response body:"
curl -s --max-time 60 "${URL}health"
echo ""
echo "$URL" > .lambda-url.txt
