#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

echo "== Update Lambda config: timeout=60, memory=2048 =="
aws lambda update-function-configuration \
    --function-name edm-factoring-scorer \
    --region us-east-1 \
    --timeout 60 \
    --memory-size 2048 \
    --output json | head -10
aws lambda wait function-updated --function-name edm-factoring-scorer --region us-east-1
echo "  ok"

echo ""
echo "== Pre-warm (direct invoke con sourceIp) =="
cat > /tmp/event.json <<'EOF'
{
  "version": "2.0",
  "routeKey": "$default",
  "rawPath": "/health",
  "rawQueryString": "",
  "headers": {"accept": "*/*", "host": "x.lambda-url.us-east-1.on.aws"},
  "requestContext": {
    "accountId": "anonymous",
    "apiId": "x",
    "domainName": "x.lambda-url.us-east-1.on.aws",
    "http": {"method": "GET", "path": "/health", "protocol": "HTTP/1.1", "sourceIp": "127.0.0.1", "userAgent": "warm"},
    "requestId": "warm-1", "routeKey": "$default", "stage": "$default",
    "time": "01/Jan/2026:00:00:00 +0000", "timeEpoch": 1735689600
  },
  "isBase64Encoded": false
}
EOF

echo "  First invoke (cold start - puede tardar ~30s)..."
START=$(date +%s)
aws lambda invoke \
    --function-name edm-factoring-scorer \
    --region us-east-1 \
    --cli-binary-format raw-in-base64-out \
    --payload file:///tmp/event.json \
    /tmp/out1.json
DUR=$(( $(date +%s) - START ))
echo "  duration: ${DUR}s"
echo "  response:"
cat /tmp/out1.json
echo ""
echo ""

echo "  Second invoke (warm - debe ser rapido)..."
START=$(date +%s)
aws lambda invoke \
    --function-name edm-factoring-scorer \
    --region us-east-1 \
    --cli-binary-format raw-in-base64-out \
    --payload file:///tmp/event.json \
    /tmp/out2.json
DUR=$(( $(date +%s) - START ))
echo "  duration: ${DUR}s"
echo "  response:"
cat /tmp/out2.json
echo ""
echo ""

echo "== Curl al Function URL ahora =="
URL="https://r3rod4pxotcozcuidbjepwzoi40rfabx.lambda-url.us-east-1.on.aws/"
curl -s --max-time 90 "${URL}health"
echo ""
