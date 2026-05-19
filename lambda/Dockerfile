# =============================================================================
# AWS Lambda container image for EDM Factoring Signals Engine
# Base: AWS Lambda Python 3.11 (Amazon Linux 2023)
# =============================================================================

FROM public.ecr.aws/lambda/python:3.11 AS builder

# Compilers (some sci packages may build from source on AL2)
RUN yum install -y gcc gcc-c++ make && yum clean all

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Install dependencies (prefer prebuilt wheels)
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir --prefer-binary -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Copy app code
COPY app/ ${LAMBDA_TASK_ROOT}/app/

# Lambda entrypoint (handler en app/handler.py expone "handler")
CMD ["app.handler.handler"]
