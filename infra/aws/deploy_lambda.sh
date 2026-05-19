#!/usr/bin/env bash
# =============================================================================
# Deploy completo del Lambda EDM Factoring Scorer
# =============================================================================
# Requisitos: WSL Ubuntu con docker + aws cli + .env cargado en el entorno
# Idempotente: se puede correr múltiples veces; actualiza si existe, crea si no
#
# Uso (desde WSL):
#   cd "/mnt/c/Users/freddyrs/Desktop/Demo EDM"
#   set -a; source <(grep -v '^#' .env | sed 's/\r$//'); set +a
#   bash infra/aws/deploy_lambda.sh
# =============================================================================

set -euo pipefail

AWS_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ECR_REPO="edm-lambda-factoring"
LAMBDA_FN="edm-factoring-scorer"
ROLE_NAME="edm-lambda-execution-role"
MODEL_BUCKET="edm-demo-models"

cd "$(dirname "$0")/../.."
PROJECT_DIR="$(pwd)"
echo "== Project dir: $PROJECT_DIR"
echo "== AWS region: $AWS_REGION"

# =============================================================================
# 1. Validar entorno
# =============================================================================
echo ""
echo "=== Step 1: validate environment ==="
for var in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
    if [ -z "${!var:-}" ]; then
        echo "ERROR: \$$var no esta seteada en el entorno"
        echo "Cargar primero con: set -a; source <(grep -v '^#' .env | sed 's/\\r\$//'); set +a"
        exit 1
    fi
done

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS account: $ACCOUNT_ID"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
echo "ECR registry: $ECR_REGISTRY"

# =============================================================================
# 2. IAM role
# =============================================================================
echo ""
echo "=== Step 2: IAM role ==="
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    echo "  Role $ROLE_NAME ya existe"
else
    echo "  Creando role $ROLE_NAME..."
    aws iam create-role --role-name "$ROLE_NAME" \
        --assume-role-policy-document '{
            "Version":"2012-10-17",
            "Statement":[{
                "Effect":"Allow",
                "Principal":{"Service":"lambda.amazonaws.com"},
                "Action":"sts:AssumeRole"
            }]
        }' >/dev/null
    aws iam attach-role-policy --role-name "$ROLE_NAME" \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    aws iam attach-role-policy --role-name "$ROLE_NAME" \
        --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
    echo "  Sleeping 10s para propagacion de IAM..."
    sleep 10
fi
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
echo "  Role ARN: $ROLE_ARN"

# =============================================================================
# 3. ECR repo
# =============================================================================
echo ""
echo "=== Step 3: ECR repository ==="
if aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "  Repo $ECR_REPO ya existe"
else
    echo "  Creando repo $ECR_REPO..."
    aws ecr create-repository --repository-name "$ECR_REPO" --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true >/dev/null
fi

# =============================================================================
# 4. Build + push container image
# =============================================================================
echo ""
echo "=== Step 4: build + push image ==="
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M)"
IMAGE_URI="${ECR_REGISTRY}/${ECR_REPO}:${IMAGE_TAG}"
IMAGE_LATEST="${ECR_REGISTRY}/${ECR_REPO}:latest"

echo "  Login a ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "  Building $IMAGE_URI..."
# Lambda no acepta OCI manifests nuevos -> forzar formato docker v2
docker buildx build \
    --platform linux/amd64 \
    --provenance=false \
    --sbom=false \
    --output type=docker \
    -t "$IMAGE_URI" -t "$IMAGE_LATEST" \
    -f lambda/Dockerfile lambda/

echo "  Pushing..."
docker push "$IMAGE_URI"
docker push "$IMAGE_LATEST"
echo "  Image disponible: $IMAGE_URI"

# =============================================================================
# 5. Lambda function (create or update)
# =============================================================================
echo ""
echo "=== Step 5: Lambda function ==="
ENV_VARS="Variables={MODEL_BUCKET=${MODEL_BUCKET},MODEL_PREFIX=factoring/v1/latest,SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}}"

if aws lambda get-function --function-name "$LAMBDA_FN" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "  Lambda existe — actualizando codigo..."
    aws lambda update-function-code \
        --function-name "$LAMBDA_FN" \
        --image-uri "$IMAGE_URI" \
        --region "$AWS_REGION" \
        --publish >/dev/null
    echo "  Esperando update..."
    aws lambda wait function-updated --function-name "$LAMBDA_FN" --region "$AWS_REGION"
    aws lambda update-function-configuration \
        --function-name "$LAMBDA_FN" \
        --timeout 30 \
        --memory-size 1024 \
        --environment "$ENV_VARS" \
        --region "$AWS_REGION" >/dev/null
else
    echo "  Creando Lambda..."
    aws lambda create-function \
        --function-name "$LAMBDA_FN" \
        --package-type Image \
        --code "ImageUri=${IMAGE_URI}" \
        --role "$ROLE_ARN" \
        --timeout 30 \
        --memory-size 1024 \
        --architectures x86_64 \
        --environment "$ENV_VARS" \
        --region "$AWS_REGION" >/dev/null
    aws lambda wait function-active --function-name "$LAMBDA_FN" --region "$AWS_REGION"
fi
echo "  Lambda ARN: $(aws lambda get-function --function-name "$LAMBDA_FN" --region "$AWS_REGION" --query Configuration.FunctionArn --output text)"

# =============================================================================
# 6. Function URL
# =============================================================================
echo ""
echo "=== Step 6: Function URL ==="
if URL=$(aws lambda get-function-url-config --function-name "$LAMBDA_FN" --region "$AWS_REGION" --query FunctionUrl --output text 2>/dev/null); then
    echo "  Function URL existe: $URL"
else
    echo "  Creando Function URL..."
    URL=$(aws lambda create-function-url-config \
        --function-name "$LAMBDA_FN" \
        --auth-type NONE \
        --cors 'AllowOrigins="*",AllowMethods="*",AllowHeaders="*"' \
        --region "$AWS_REGION" \
        --query FunctionUrl --output text)
    # permitir invocacion publica
    aws lambda add-permission \
        --function-name "$LAMBDA_FN" \
        --statement-id "FunctionURLAllowPublicAccess" \
        --action lambda:InvokeFunctionUrl \
        --principal "*" \
        --function-url-auth-type NONE \
        --region "$AWS_REGION" 2>&1 | head -3
    echo "  Function URL creada: $URL"
fi

# =============================================================================
# 7. Smoke test
# =============================================================================
echo ""
echo "=== Step 7: smoke test ==="
echo "  Waiting 10s for Lambda to be ready..."
sleep 10
echo "  Testing /health..."
HEALTH=$(curl -s --max-time 30 "${URL}health" || echo "TIMEOUT")
echo "  Response: $HEALTH"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "========================================"
echo " DEPLOY COMPLETE"
echo "========================================"
echo " Lambda: $LAMBDA_FN"
echo " Image:  $IMAGE_URI"
echo " URL:    $URL"
echo "========================================"
echo "Guardando URL en .lambda-url.txt..."
echo "$URL" > .lambda-url.txt
echo ""
echo "Next:"
echo "  1. Test /score: curl -X POST \"\${URL}score\" -H \"content-type: application/json\" -d '{\"relacion_id\":\"...\"}' "
echo "  2. Configurar Supabase Database Webhook -> \${URL}score-and-emit"
