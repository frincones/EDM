#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

echo "== Identity =="
aws sts get-caller-identity

echo ""
echo "== Function URL config =="
URL=$(aws lambda get-function-url-config --function-name edm-factoring-scorer --region us-east-1 --query FunctionUrl --output text)
echo "URL: $URL"
aws lambda get-function-url-config --function-name edm-factoring-scorer --region us-east-1 --query AuthType --output text

echo ""
echo "== Resource policy =="
aws lambda get-policy --function-name edm-factoring-scorer --region us-east-1 2>&1 | head -20

echo ""
echo "== Curl /health =="
curl -s --max-time 60 "${URL}health"
echo ""
echo "=== HTTP details ==="
curl -sI --max-time 60 "${URL}health" 2>&1 | head -10

echo ""
echo "== CloudWatch logs (last 30s) =="
LATEST_STREAM=$(aws logs describe-log-streams --log-group-name "/aws/lambda/edm-factoring-scorer" --region us-east-1 --order-by LastEventTime --descending --limit 1 --query 'logStreams[0].logStreamName' --output text 2>/dev/null || echo "")
if [ -n "$LATEST_STREAM" ] && [ "$LATEST_STREAM" != "None" ]; then
    aws logs get-log-events --log-group-name "/aws/lambda/edm-factoring-scorer" --log-stream-name "$LATEST_STREAM" --region us-east-1 --limit 30 --query 'events[*].message' --output text 2>&1 | head -50
else
    echo "  (sin streams aun)"
fi
