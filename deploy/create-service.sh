#!/usr/bin/env bash
# =============================================================================
# Create the App Runner service from the image already in ECR.
#
#   ./deploy/create-service.sh
#
# Pinned to ONE instance on purpose. The session store lives in memory, so a
# second instance would mean a customer takes a ticket on one and the technician
# looks it up on the other and gets a 404 — the demo failing at exactly the
# moment it is meant to land. Scaling past one requires the DynamoDB adapter
# described in deploy/README.md first.
#
# Re-runnable: creates what is missing, reuses what is not.
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
REPO="${IMAGE_REPO_NAME:-field-office-pwa}"
SERVICE="${APPRUNNER_SERVICE:-field-office-pwa}"
ECR_ROLE="AppRunnerECRAccessRole"
INSTANCE_ROLE="${INSTANCE_ROLE:-FieldOfficePwaInstanceRole}"
TABLE="${DYNAMODB_TABLE:-field-office-pwa}"
SCALING="single-instance"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
IMAGE="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest"
say "Deploying $IMAGE"

# --- role App Runner uses to pull from ECR -----------------------------------
say "ECR access role"
if aws iam get-role --role-name "$ECR_ROLE" >/dev/null 2>&1; then
  echo "  $ECR_ROLE exists"
else
  aws iam create-role --role-name "$ECR_ROLE" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{"Effect":"Allow","Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]
    }' --query 'Role.RoleName' --output text
  aws iam attach-role-policy --role-name "$ECR_ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
  echo "  waiting for the role to propagate"
  sleep 12
fi
ECR_ROLE_ARN="$(aws iam get-role --role-name "$ECR_ROLE" --query 'Role.Arn' --output text)"

# --- what the container itself may do ----------------------------------------
say "Instance role"
INSTANCE_ROLE_ARN="$(aws iam get-role --role-name "$INSTANCE_ROLE" --query 'Role.Arn' --output text 2>/dev/null || true)"
if [ -n "$INSTANCE_ROLE_ARN" ]; then
  echo "  $INSTANCE_ROLE — DynamoDB store enabled ($TABLE)"
  INSTANCE_CONFIG="{ \"Cpu\": \"1 vCPU\", \"Memory\": \"2 GB\", \"InstanceRoleArn\": \"$INSTANCE_ROLE_ARN\" }"
  ENV_VARS="\"NODE_ENV\": \"production\", \"DEMO_STAFF_ID\": \"demo-technician\", \"DYNAMODB_TABLE\": \"$TABLE\""
else
  echo "  not found — the app will run with the in-memory store"
  echo "  (create it with ./deploy/create-instance-role.sh if you want tickets to survive restarts)"
  INSTANCE_CONFIG='{ "Cpu": "1 vCPU", "Memory": "2 GB" }'
  ENV_VARS='"NODE_ENV": "production", "DEMO_STAFF_ID": "demo-technician"'
fi

# --- one instance, always ----------------------------------------------------
say "Auto-scaling configuration"
SCALING_ARN="$(aws apprunner list-auto-scaling-configurations --region "$REGION" \
  --auto-scaling-configuration-name "$SCALING" \
  --query 'AutoScalingConfigurationSummaryList[0].AutoScalingConfigurationArn' \
  --output text 2>/dev/null || true)"
if [ -z "$SCALING_ARN" ] || [ "$SCALING_ARN" = "None" ]; then
  SCALING_ARN="$(aws apprunner create-auto-scaling-configuration \
    --auto-scaling-configuration-name "$SCALING" \
    --region "$REGION" --min-size 1 --max-size 1 --max-concurrency 100 \
    --query 'AutoScalingConfiguration.AutoScalingConfigurationArn' --output text)"
fi
echo "  $SCALING_ARN"

# --- the service -------------------------------------------------------------
say "Service"
EXISTING="$(aws apprunner list-services --region "$REGION" \
  --query "ServiceSummaryList[?ServiceName=='$SERVICE'].ServiceArn" --output text)"

if [ -n "$EXISTING" ] && [ "$EXISTING" != "None" ]; then
  echo "  $SERVICE exists — updating configuration and deploying"

  # App Runner refuses any update while an operation is in flight, and a
  # previous deploy is often still settling. Wait rather than fail.
  while true; do
    CURRENT="$(aws apprunner describe-service --service-arn "$EXISTING" --region "$REGION" \
      --query 'Service.Status' --output text)"
    [ "$CURRENT" = "OPERATION_IN_PROGRESS" ] || break
    printf '\r  waiting for the previous operation to finish...'
    sleep 15
  done
  printf '\r%*s\r' 50 ''
  aws apprunner update-service --service-arn "$EXISTING" --region "$REGION" \
    --source-configuration "{
      \"AuthenticationConfiguration\": { \"AccessRoleArn\": \"$ECR_ROLE_ARN\" },
      \"AutoDeploymentsEnabled\": false,
      \"ImageRepository\": {
        \"ImageIdentifier\": \"$IMAGE\",
        \"ImageRepositoryType\": \"ECR\",
        \"ImageConfiguration\": {
          \"Port\": \"3000\",
          \"RuntimeEnvironmentVariables\": { $ENV_VARS }
        }
      }
    }" \
    --instance-configuration "$INSTANCE_CONFIG" \
    --query 'OperationId' --output text
  ARN="$EXISTING"
else
  ARN="$(aws apprunner create-service \
    --service-name "$SERVICE" \
    --region "$REGION" \
    --source-configuration "{
      \"AuthenticationConfiguration\": { \"AccessRoleArn\": \"$ECR_ROLE_ARN\" },
      \"AutoDeploymentsEnabled\": false,
      \"ImageRepository\": {
        \"ImageIdentifier\": \"$IMAGE\",
        \"ImageRepositoryType\": \"ECR\",
        \"ImageConfiguration\": {
          \"Port\": \"3000\",
          \"RuntimeEnvironmentVariables\": { $ENV_VARS }
        }
      }
    }" \
    --instance-configuration "$INSTANCE_CONFIG" \
    --auto-scaling-configuration-arn "$SCALING_ARN" \
    --health-check-configuration '{
      "Protocol": "HTTP",
      "Path": "/api/health",
      "Interval": 10,
      "Timeout": 5,
      "HealthyThreshold": 1,
      "UnhealthyThreshold": 5
    }' \
    --query 'Service.ServiceArn' --output text)"
  echo "  created"
fi

# --- wait --------------------------------------------------------------------
say "Waiting for the service to come up (a few minutes)"
while true; do
  STATUS="$(aws apprunner describe-service --service-arn "$ARN" --region "$REGION" \
    --query 'Service.Status' --output text)"
  printf '\r  %-24s' "$STATUS"
  case "$STATUS" in
    RUNNING) break ;;
    CREATE_FAILED|DELETE_FAILED|OPERATION_IN_PROGRESS) ;;
    *FAILED*) break ;;
  esac
  [ "$STATUS" = "RUNNING" ] && break
  sleep 10
done
echo

URL="$(aws apprunner describe-service --service-arn "$ARN" --region "$REGION" \
  --query 'Service.ServiceUrl' --output text)"

if [ "$STATUS" != "RUNNING" ]; then
  say "Service is $STATUS"
  echo "  $ARN"
  exit 1
fi

say "Live"
echo "  https://$URL/o/folsom      customer app"
echo "  https://$URL/counter       counter view"
echo "  $ARN"
