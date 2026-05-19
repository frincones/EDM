#!/usr/bin/env bash
# Wrapper que carga .env y ejecuta deploy_lambda.sh
# Uso: wsl bash "/mnt/c/Users/freddyrs/Desktop/Demo EDM/infra/aws/run_deploy.sh"
set -e
cd "$(dirname "$0")/../.."
set -a
source <(grep -v '^#' .env | sed 's/\r$//')
set +a
chmod +x infra/aws/deploy_lambda.sh
bash infra/aws/deploy_lambda.sh
