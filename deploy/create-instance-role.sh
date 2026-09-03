#!/usr/bin/env bash
# =============================================================================
# The App Runner INSTANCE role — what the running container is allowed to do.
#
# Distinct from AppRunnerECRAccessRole, which only pulls the image. This one is
# assumed by the application itself, which is why it is scoped to exactly the
# five DynamoDB actions the store performs, on exactly one table and its index.
#
# No Scan. No ListTables. No DeleteTable. A compromised container should not be
# able to enumerate or destroy anything — and the application never needs to.
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
TABLE="${DYNAMODB_TABLE:-field-office-pwa}"
ROLE="${INSTANCE_ROLE:-FieldOfficePwaInstanceRole}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"

say "Instance role $ROLE"
if aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "  exists"
else
  aws iam create-role --role-name "$ROLE" \
    --description "Field Office PWA container: DynamoDB access to one table" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{
        "Effect":"Allow",
        "Principal":{"Service":"tasks.apprunner.amazonaws.com"},
        "Action":"sts:AssumeRole"
      }]
    }' --query 'Role.RoleName' --output text
fi

say "Policy"
aws iam put-role-policy --role-name "$ROLE" --policy-name DynamoDbSessionStore \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Sid\":\"SessionStoreOnly\",
      \"Effect\":\"Allow\",
      \"Action\":[
        \"dynamodb:GetItem\",
        \"dynamodb:PutItem\",
        \"dynamodb:UpdateItem\",
        \"dynamodb:DeleteItem\",
        \"dynamodb:Query\"
      ],
      \"Resource\":[
        \"arn:aws:dynamodb:$REGION:$ACCOUNT:table/$TABLE\",
        \"arn:aws:dynamodb:$REGION:$ACCOUNT:table/$TABLE/index/*\"
      ]
    }]
  }"
echo "  five actions, one table, one index"

echo "  waiting for the role to propagate"
sleep 12
aws iam get-role --role-name "$ROLE" --query 'Role.Arn' --output text
