#!/bin/bash
set -e
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"your-project-id"}
IMAGE="gcr.io/$PROJECT_ID/pulse"
REGION="asia-south1"
SERVICE="pulse"
echo "==> Building Docker image..."
docker build -t "$IMAGE:latest" .
echo "==> Pushing to Google Container Registry..."
docker push "$IMAGE:latest"
echo "==> Deploying to Cloud Run in $REGION..."
gcloud run deploy "$SERVICE" --image="$IMAGE:latest" --region="$REGION" --platform=managed --allow-unauthenticated --memory=512Mi
echo "==> Deployment complete!"
