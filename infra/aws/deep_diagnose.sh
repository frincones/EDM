#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

URL="https://gq2wqiw2n46rafrh2aekl4jkzi0iueth.lambda-url.us-east-1.on.aws/health"

echo "== 1. Forzar IPv4 =="
curl -4 -sI --max-time 30 "$URL" 2>&1 | head -5
echo ""

echo "== 2. User-Agent Mozilla =="
curl -sI -H "User-Agent: Mozilla/5.0" --max-time 30 "$URL" 2>&1 | head -5
echo ""

echo "== 3. Sin headers =="
curl -sI -H "" --max-time 30 "$URL" 2>&1 | head -5
echo ""

echo "== 4. Verify policy fresh =="
aws lambda get-policy --function-name edm-factoring-scorer --region us-east-1 \
    --query 'Policy' --output text | python3 -m json.tool
echo ""

echo "== 5. Re-invoke via aws cli con event-source FunctionUrl =="
cat > /tmp/evt.json <<'EOF'
{
  "version": "2.0", "routeKey": "$default", "rawPath": "/health", "rawQueryString": "",
  "headers": {"accept": "*/*", "host": "x", "user-agent": "AWS-CLI"},
  "requestContext": {
    "accountId": "anonymous", "apiId": "gq2wqiw2n46rafrh2aekl4jkzi0iueth",
    "domainName": "gq2wqiw2n46rafrh2aekl4jkzi0iueth.lambda-url.us-east-1.on.aws",
    "http": {"method": "GET", "path": "/health", "protocol": "HTTP/1.1", "sourceIp": "127.0.0.1", "userAgent": "AWS-CLI"},
    "requestId": "test", "routeKey": "$default", "stage": "$default",
    "time": "01/Jan/2026:00:00:00 +0000", "timeEpoch": 1735689600
  },
  "isBase64Encoded": false
}
EOF
aws lambda invoke --function-name edm-factoring-scorer --region us-east-1 \
    --cli-binary-format raw-in-base64-out \
    --payload file:///tmp/evt.json /tmp/out.json
echo "  body:"
cat /tmp/out.json
echo ""
echo ""

echo "== 6. Check CloudWatch logs (any invocations recorded?) =="
aws logs describe-log-streams --log-group-name "/aws/lambda/edm-factoring-scorer" --region us-east-1 \
    --order-by LastEventTime --descending --limit 3 \
    --query 'logStreams[*].{name:logStreamName,last:lastEventTimestamp}' --output table 2>&1 || echo "  no log group"

echo ""
echo "== 7. Account-level Lambda invocation policy =="
aws lambda get-account-settings --region us-east-1 --output json 2>&1 | head -10
