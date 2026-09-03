#!/usr/bin/env bash
# =============================================================================
# Build the image and push it to ECR, via CodeBuild.
#
#   ./deploy/build-and-push.sh
#
# Runs the build in AWS rather than locally: no Docker daemon needed here, and
# CodeBuild's runners are x86_64, so the image cannot end up ARM-only and fail
# on App Runner with "exec format error".
#
# Creates what is missing and reuses what is not, so it is safe to re-run.
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
REPO="${IMAGE_REPO_NAME:-field-office-pwa}"
PROJECT="${CODEBUILD_PROJECT:-field-office-pwa-build}"
ROLE_NAME="${CODEBUILD_ROLE:-FieldOfficePwaCodeBuildRole}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "Checking credentials"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
echo "  account $ACCOUNT, region $REGION"

say "ECR repository"
if aws ecr describe-repositories --repository-names "$REPO" --region "$REGION" >/dev/null 2>&1; then
  echo "  $REPO already exists"
else
  aws ecr create-repository \
    --repository-name "$REPO" \
    --region "$REGION" \
    --image-scanning-configuration scanOnPush=true \
    --query 'repository.repositoryUri' --output text
fi

say "Packaging source"
BUCKET="codebuild-${ACCOUNT}-${REGION}-src"
aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null || {
  echo "  creating s3://$BUCKET"
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
  # Source archives contain application code; they should never be public.
  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
}

TMP="$(mktemp -d)"
ZIP="$TMP/source.zip"
# Same exclusions as .dockerignore: build inputs only.
zip -rq "$ZIP" . \
  -x 'node_modules/*' '.next/*' '.git/*' 'legacy-demo/*' 'docs/*' 'client_docs/*' \
     'forms/*' '.claude/*' '.agents/*' '.playwright-mcp/*' '*.tsbuildinfo'
SIZE="$(du -h "$ZIP" | cut -f1)"
echo "  $SIZE → s3://$BUCKET/source.zip"
aws s3 cp "$ZIP" "s3://$BUCKET/source.zip" --only-show-errors
rm -rf "$TMP"

say "CodeBuild project"
if aws codebuild batch-get-projects --names "$PROJECT" --region "$REGION" \
     --query 'projects[0].name' --output text 2>/dev/null | grep -q "$PROJECT"; then
  echo "  $PROJECT already exists"
else
  echo "  creating IAM role $ROLE_NAME"
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    >/dev/null 2>&1 || echo "  role exists"
  for POLICY in \
    arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser \
    arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
    arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
  do
    aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$POLICY" >/dev/null 2>&1 || true
  done
  echo "  waiting for the role to propagate"
  sleep 12

  ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
  aws codebuild create-project \
    --name "$PROJECT" \
    --region "$REGION" \
    --source "{\"type\":\"S3\",\"location\":\"$BUCKET/source.zip\",\"buildspec\":\"deploy/buildspec.yml\"}" \
    --artifacts '{"type":"NO_ARTIFACTS"}' \
    --environment "{
        \"type\":\"LINUX_CONTAINER\",
        \"image\":\"aws/codebuild/standard:7.0\",
        \"computeType\":\"BUILD_GENERAL1_SMALL\",
        \"privilegedMode\":true,
        \"environmentVariables\":[
          {\"name\":\"AWS_ACCOUNT_ID\",\"value\":\"$ACCOUNT\"},
          {\"name\":\"IMAGE_REPO_NAME\",\"value\":\"$REPO\"}
        ]
      }" \
    --service-role "$ROLE_ARN" \
    --query 'project.name' --output text
fi

say "Starting build"
BUILD_ID="$(aws codebuild start-build --project-name "$PROJECT" --region "$REGION" \
  --query 'build.id' --output text)"
echo "  $BUILD_ID"

say "Waiting"
while true; do
  STATUS="$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
    --query 'builds[0].buildStatus' --output text)"
  PHASE="$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
    --query 'builds[0].currentPhase' --output text)"
  printf '\r  %-12s %s        ' "$STATUS" "$PHASE"
  [ "$STATUS" = "IN_PROGRESS" ] || break
  sleep 6
done
echo

if [ "$STATUS" != "SUCCEEDED" ]; then
  say "Build $STATUS"
  echo "Logs:"
  aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
    --query 'builds[0].logs.deepLink' --output text
  exit 1
fi

say "Pushed"
aws ecr describe-images --repository-name "$REPO" --region "$REGION" \
  --query 'sort_by(imageDetails,&imagePushedAt)[-1].{tags:imageTags,pushed:imagePushedAt,mb:imageSizeInBytes}' \
  --output table
echo
echo "Image: $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest"
echo "Next:  see deploy/README.md to create the App Runner service."
