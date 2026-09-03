#!/usr/bin/env bash
# =============================================================================
# Create the DynamoDB table.
#
#   ./deploy/create-table.sh
#
# On-demand billing, because load here is spiky and unknown: a field office is
# idle overnight and busy at opening. Guessing provisioned capacity wrong
# throttles customers mid-form, which is a far worse outcome than the few
# dollars a month on-demand costs at this scale.
#
# Re-runnable.
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
TABLE="${DYNAMODB_TABLE:-field-office-pwa}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "Table $TABLE in $REGION"
if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
  echo "  already exists"
else
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --region "$REGION" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
      AttributeName=gsi1pk,AttributeType=S \
      AttributeName=gsi1sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --global-secondary-indexes '[{
      "IndexName": "token-index",
      "KeySchema": [
        {"AttributeName":"gsi1pk","KeyType":"HASH"},
        {"AttributeName":"gsi1sk","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    }]' \
    --query 'TableDescription.TableStatus' --output text

  echo "  waiting for it to become active"
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
fi

say "Time to live"
TTL_STATUS="$(aws dynamodb describe-time-to-live --table-name "$TABLE" --region "$REGION" \
  --query 'TimeToLiveDescription.TimeToLiveStatus' --output text)"
if [ "$TTL_STATUS" = "ENABLED" ]; then
  echo "  already enabled on expires_epoch"
else
  aws dynamodb update-time-to-live \
    --table-name "$TABLE" --region "$REGION" \
    --time-to-live-specification "Enabled=true,AttributeName=expires_epoch" \
    --query 'TimeToLiveSpecification.AttributeName' --output text
fi

cat <<'NOTE'

  TTL is a BACKSTOP, not the retention mechanism. AWS collects expired items
  "typically within 48 hours", while this product promises the customer their
  details are deleted at close of business. Deletion is therefore done by the
  application: explicitly on completion, by the sweeper on its interval, and by
  filtering expired items out of every read so one that has not been collected
  is never returned. TTL only removes what those missed.

NOTE

say "Permissions"
cat <<NOTE
  The App Runner instance role needs DynamoDB access to this table. Note this
  is the INSTANCE role, not the ECR access role — the latter only pulls images:

    aws iam create-role --role-name FieldOfficePwaInstanceRole \\
      --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"tasks.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

    aws iam put-role-policy --role-name FieldOfficePwaInstanceRole \\
      --policy-name DynamoDbAccess --policy-document '{
        "Version":"2012-10-17",
        "Statement":[{
          "Effect":"Allow",
          "Action":["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query"],
          "Resource":[
            "arn:aws:dynamodb:$REGION:<account>:table/$TABLE",
            "arn:aws:dynamodb:$REGION:<account>:table/$TABLE/index/*"
          ]
        }]
      }'

  Then set DYNAMODB_TABLE=$TABLE on the service and redeploy. Without that
  variable the application uses the in-memory store and ignores this table.
NOTE
