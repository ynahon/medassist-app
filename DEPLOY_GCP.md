# Deploy MedAssist Backend to Google Cloud

## Prerequisites

1. Google Cloud account with billing enabled
2. `gcloud` CLI installed: https://cloud.google.com/sdk/docs/install
3. Your GitHub repository: https://github.com/ynahon/medassist-app

## Step 1: Set Up Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create medassist-app --name="MedAssist App"

# Set as current project
gcloud config set project medassist-app

# Enable billing (required - do this in Cloud Console)
# https://console.cloud.google.com/billing

# Enable required APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com
```

## Step 2: Create Cloud SQL PostgreSQL Database

```bash
# Create PostgreSQL instance (this takes ~5 minutes)
gcloud sql instances create medassist-db \
  --database-version=POSTGRES_15 \
  --cpu=1 \
  --memory=3840MB \
  --region=us-central1 \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create medassist --instance=medassist-db

# Create user
gcloud sql users create medassist-user \
  --instance=medassist-db \
  --password=YOUR_USER_PASSWORD

# Get instance connection name (save this!)
gcloud sql instances describe medassist-db --format="get(connectionName)"
# Output: PROJECT_ID:us-central1:medassist-db
```

## Step 3: Clone and Deploy

```bash
# Clone your repository
git clone https://github.com/ynahon/medassist-app.git
cd medassist-app

# Build and deploy to Cloud Run
gcloud run deploy medassist-api \
  --source . \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --add-cloudsql-instances=PROJECT_ID:us-central1:medassist-db \
  --set-env-vars="DATABASE_URL=postgresql://medassist-user:YOUR_USER_PASSWORD@localhost/medassist?host=/cloudsql/PROJECT_ID:us-central1:medassist-db" \
  --set-env-vars="SESSION_SECRET=your-session-secret" \
  --set-env-vars="TWILIO_ACCOUNT_SID=your-twilio-sid" \
  --set-env-vars="TWILIO_AUTH_TOKEN=your-twilio-token" \
  --set-env-vars="TWILIO_PHONE_NUMBER=your-twilio-number" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10
```

## Step 4: Get Your API URL

After deployment, you'll get a URL like:
```
https://medassist-api-XXXXXX-uc.a.run.app
```

## Step 5: Update Your Expo App

Update your Expo app to use the new API URL:

1. Set environment variable in app.json or .env:
```
EXPO_PUBLIC_DOMAIN=medassist-api-XXXXXX-uc.a.run.app
```

## Estimated Costs

- **Cloud SQL (PostgreSQL)**: ~$10-30/month for db-f1-micro
- **Cloud Run**: Free tier covers ~2 million requests/month
- **Cloud Build**: Free tier covers 120 build-minutes/day

## Useful Commands

```bash
# View logs
gcloud run services logs read medassist-api --region=us-central1

# Update deployment
gcloud run deploy medassist-api --source . --region=us-central1

# Delete resources (when done)
gcloud run services delete medassist-api --region=us-central1
gcloud sql instances delete medassist-db
```

## Using Cloud Build (CI/CD)

For automated deployments, use Cloud Build:

```bash
gcloud builds submit \
  --substitutions=_REGION=us-central1,_INSTANCE_CONNECTION_NAME=PROJECT:us-central1:medassist-db,_DATABASE_URL=your-url,_SESSION_SECRET=your-secret
```
