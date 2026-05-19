#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

echo "== Function config (incluye ImageUri y env) =="
aws lambda get-function-configuration --function-name edm-factoring-scorer --region us-east-1 \
    --query '{ImageUri:Code.ImageUri,Role:Role,Env:Environment.Variables}'

echo ""
echo "== Function code details =="
aws lambda get-function --function-name edm-factoring-scorer --region us-east-1 --query 'Code.ImageUri'

echo ""
echo "== Re-attempt Function URL invocation con verbose =="
URL="https://r3rod4pxotcozcuidbjepwzoi40rfabx.lambda-url.us-east-1.on.aws/"
curl -v --max-time 60 "${URL}health" 2>&1 | head -30

echo ""
echo "== Direct invoke con payload COMPLETO de Function URL =="
cat > /tmp/lambda-event.json <<'EOF'
{
  "version": "2.0",
  "routeKey": "$default",
  "rawPath": "/health",
  "rawQueryString": "",
  "headers": {
    "accept": "*/*",
    "host": "r3rod4pxotcozcuidbjepwzoi40rfabx.lambda-url.us-east-1.on.aws",
    "user-agent": "curl/8.0"
  },
  "requestContext": {
    "accountId": "anonymous",
    "apiId": "r3rod4pxotcozcuidbjepwzoi40rfabx",
    "domainName": "r3rod4pxotcozcuidbjepwzoi40rfabx.lambda-url.us-east-1.on.aws",
    "domainPrefix": "r3rod4pxotcozcuidbjepwzoi40rfabx",
    "http": {
      "method": "GET",
      "path": "/health",
      "protocol": "HTTP/1.1",
      "sourceIp": "127.0.0.1",
      "userAgent": "curl/8.0"
    },
    "requestId": "test-req-id",
    "routeKey": "$default",
    "stage": "$default",
    "time": "01/Jan/2026:00:00:00 +0000",
    "timeEpoch": 1735689600
  },
  "isBase64Encoded": false
}
EOF
aws lambda invoke \
    --function-name edm-factoring-scorer \
    --region us-east-1 \
    --cli-binary-format raw-in-base64-out \
    --payload file:///tmp/lambda-event.json \
    /tmp/lambda-out.json
echo "Response payload:"
cat /tmp/lambda-out.json
