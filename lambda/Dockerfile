# =============================================================================
# AWS Lambda container image for EDM Factoring Signals Engine
# Base: AWS Lambda Python 3.11 runtime, arm64 architecture
# =============================================================================

FROM public.ecr.aws/lambda/python:3.11

# Install dependencies first (better layer caching)
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Copy app code
COPY app/ ${LAMBDA_TASK_ROOT}/app/

# Lambda entrypoint
CMD ["app.handler.handler"]
