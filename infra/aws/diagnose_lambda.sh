#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a

echo "== Function state =="
aws lambda get-function --function-name edm-factoring-scorer --region us-east-1 \
    --query 'Configuration.{State:State,LastUpdateStatus:LastUpdateStatus,LastUpdateStatusReason:LastUpdateStatusReason,Architectures:Architectures,PackageType:PackageType,ImageUri:Code.ImageUri,Role:Role}' \
    --output json

echo ""
echo "== Function URL details =="
aws lambda get-function-url-config --function-name edm-factoring-scorer --region us-east-1 --output json

echo ""
echo "== Invocar directamente con AWS API (bypass URL) =="
aws lambda invoke \
    --function-name edm-factoring-scorer \
    --region us-east-1 \
    --payload '{"version":"2.0","rawPath":"/health","requestContext":{"http":{"method":"GET"}},"headers":{}}' \
    --cli-binary-format raw-in-base64-out \
    /tmp/lambda-out.json
echo "Response:"
cat /tmp/lambda-out.json
echo ""
echo ""
echo "== Buscar log streams (varios intentos) =="
sleep 5
aws logs describe-log-streams --log-group-name "/aws/lambda/edm-factoring-scorer" --region us-east-1 --order-by LastEventTime --descending --limit 3 2>&1
