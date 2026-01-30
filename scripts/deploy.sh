#!/bin/bash
set -e

# Fracti Deployment Script
# Usage: ./scripts/deploy.sh [stage] [component]
# Components: all, frontend, backend, bot
# Examples:
#   ./scripts/deploy.sh dev           # Deploy everything
#   ./scripts/deploy.sh dev frontend  # Frontend only (fastest)
#   ./scripts/deploy.sh dev backend   # Backend only (CDK)
#   ./scripts/deploy.sh dev bot       # Bot webhook only

STAGE=${1:-dev}
COMPONENT=${2:-all}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Fracti Deployment Script ==="
echo "Stage: $STAGE"
echo "Component: $COMPONENT"
echo ""

# Validate component
if [[ ! "$COMPONENT" =~ ^(all|frontend|backend|bot)$ ]]; then
  echo "Error: Invalid component '$COMPONENT'"
  echo "Valid components: all, frontend, backend, bot"
  exit 1
fi

# Load environment variables
if [ -f "$ROOT_DIR/.env" ]; then
  export $(grep -E '^AWS|^TELEGRAM|^MINI_APP' "$ROOT_DIR/.env" | xargs)
  echo "Loaded environment from .env"
else
  echo "Error: .env file not found"
  exit 1
fi

# Verify AWS credentials
echo ""
echo "1. Verifying AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "Error: AWS credentials not valid"; exit 1; }
echo "   AWS credentials verified"

# Get stack outputs
STACK_NAME="tma-$STAGE"
get_stack_outputs() {
  echo "   Getting stack outputs..."
  WEBHOOK_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='TelegramWebhookUrl'].OutputValue" --output text 2>/dev/null || echo "")
  CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" --output text 2>/dev/null || echo "")
  CLOUDFRONT_DIST_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text 2>/dev/null || echo "")
  FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text 2>/dev/null || echo "")
}

# Build
do_build() {
  echo ""
  echo "2. Building all packages..."
  cd "$ROOT_DIR"
  pnpm run build
}

# Deploy backend (CDK)
deploy_backend() {
  echo ""
  echo "Deploying infrastructure with CDK..."
  cd "$ROOT_DIR/infra/cdk"
  pnpm exec cdk deploy --all --require-approval never
}

# Deploy frontend (Lambda + S3 + CloudFront)
deploy_frontend() {
  echo ""
  echo "Updating GUI Lambda function..."
  cd "$ROOT_DIR"

  if [ ! -d "apps/web/build/server" ]; then
    echo "Error: Frontend build not found at apps/web/build/server"
    echo "Run 'pnpm run build' first"
    exit 1
  fi

  # Create zip for Lambda update
  cd apps/web/build
  zip -rq lambda.zip . -x "client/*"

  # Update Lambda function code
  GUI_FUNCTION_NAME="tma-gui-$STAGE"
  aws lambda update-function-code \
    --function-name "$GUI_FUNCTION_NAME" \
    --zip-file fileb://lambda.zip \
    --publish > /dev/null
  echo "   GUI Lambda updated"

  # Wait for Lambda to be ready
  aws lambda wait function-updated --function-name "$GUI_FUNCTION_NAME"
  echo "   Lambda is ready"

  rm lambda.zip
  cd "$ROOT_DIR"

  echo ""
  echo "Uploading frontend assets to S3..."

  if [ -z "$FRONTEND_BUCKET" ] || [ "$FRONTEND_BUCKET" == "None" ]; then
    echo "Error: Could not get FrontendBucketName from stack"
    exit 1
  fi

  aws s3 sync apps/web/build/client "s3://$FRONTEND_BUCKET" --delete

  echo ""
  echo "Invalidating CloudFront cache..."
  if [ -n "$CLOUDFRONT_DIST_ID" ] && [ "$CLOUDFRONT_DIST_ID" != "None" ]; then
    INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DIST_ID" --paths "/*" --query 'Invalidation.Id' --output text)
    echo "   Invalidation ID: $INVALIDATION_ID"
    echo "   Waiting for invalidation to complete..."
    aws cloudfront wait invalidation-completed --distribution-id "$CLOUDFRONT_DIST_ID" --id "$INVALIDATION_ID"
    echo "   Cache invalidated"
  fi
}

# Setup bot webhook
setup_bot() {
  echo ""
  echo "Configuring Telegram bot..."
  if [ -z "$WEBHOOK_URL" ] || [ "$WEBHOOK_URL" == "None" ]; then
    echo "Error: Could not get TelegramWebhookUrl from stack"
    exit 1
  fi
  export WEBHOOK_URL
  cd "$ROOT_DIR"
  pnpm exec tsx infra/cdk/scripts/setup.ts
}

# Execute based on component
case "$COMPONENT" in
  all)
    do_build
    deploy_backend
    get_stack_outputs
    echo ""
    echo "   Webhook URL: $WEBHOOK_URL"
    echo "   CloudFront: $CLOUDFRONT_DOMAIN"
    setup_bot
    deploy_frontend
    ;;
  frontend)
    do_build
    get_stack_outputs
    deploy_frontend
    ;;
  backend)
    do_build
    deploy_backend
    ;;
  bot)
    get_stack_outputs
    setup_bot
    ;;
esac

echo ""
echo "=== Deployment Complete ==="
if [ -n "$CLOUDFRONT_DOMAIN" ] && [ "$CLOUDFRONT_DOMAIN" != "None" ]; then
  echo ""
  echo "App URL: https://$CLOUDFRONT_DOMAIN/app"
  echo "Bot: https://t.me/FractiBot"
fi
echo ""
