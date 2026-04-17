#!/bin/bash
set -euo pipefail

PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT:-}}

if [[ -z "${PROJECT_ID}" ]]; then
	echo "ERROR: Set GOOGLE_CLOUD_PROJECT (or GCLOUD_PROJECT) before deploying."
	exit 1
fi

COMMIT_SHA=${COMMIT_SHA:-"$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"}

echo "==> Submitting Cloud Build for project ${PROJECT_ID}"
echo "==> Using COMMIT_SHA=${COMMIT_SHA}"

gcloud builds submit \
	--project "${PROJECT_ID}" \
	--config cloudbuild.yaml \
	--substitutions=COMMIT_SHA="${COMMIT_SHA}" \
	.

echo "==> Deployment pipeline completed."
