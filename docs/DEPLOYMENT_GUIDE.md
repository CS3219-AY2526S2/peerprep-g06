# PeerPrep Deployment Guide

## Overview

PeerPrep consists of a static frontend, four backend services, and three external platform dependencies:

- Supabase for authentication and persistent application data
- Redis for low-latency shared state used by realtime services
- RabbitMQ for backend event delivery between matching and collaboration

The application is deployed in two shapes:

- local development: Docker Compose for backend services and RabbitMQ, plus a separately started frontend
- cloud deployment: S3 and CloudFront for the frontend, ECS Fargate for backend services, and Nginx as the public API gateway

## Application Architecture

### Frontend

The frontend is a Vite application in [`frontend/`](../frontend/). It uses public `VITE_*` variables at build time and talks to the backend over HTTP and Socket.IO.

The frontend connects to:

- `user-service` for account and profile operations
- `question-service` for question retrieval and management
- `matching-service` for queueing and match events
- `collaboration-service` for live collaboration session traffic

### Backend services

#### user-service

[`services/user-service/`](../services/user-service/) exposes user-related APIs and uses Supabase as its primary backend dependency.

#### question-service

[`services/question-service/`](../services/question-service/) exposes question-related APIs and also uses Supabase as its primary backend dependency.

#### matching-service

[`services/matching-service/`](../services/matching-service/) handles queueing and match formation. It uses:

- Redis for queue state and short-lived matchmaking state
- RabbitMQ to publish match-created events
- question-service to fetch question data needed for a match
- Socket.IO to push realtime queue and match updates to the frontend

#### collaboration-service

[`services/collaboration-service/`](../services/collaboration-service/) handles live session orchestration after a match is created. It uses:

- RabbitMQ to consume match-created events from matching-service
- Redis for session state, presence, grace periods, and short-lived collaboration data
- Supabase for application-integrated backend access
- Socket.IO to power collaboration and session notifications

### Messaging and realtime flow

The realtime and messaging path is:

1. The frontend connects to `matching-service` over Socket.IO and joins a matchmaking queue.
2. `matching-service` stores queue state in Redis.
3. When a match is formed, `matching-service` publishes an event to RabbitMQ.
4. `collaboration-service` consumes that event and prepares the collaboration session.
5. The frontend connects to `collaboration-service` over Socket.IO for session-ready notifications and live collaboration traffic.

Redis and RabbitMQ serve different purposes:

- Redis stores shared transient state
- RabbitMQ carries backend events between services

## Local Deployment

### Local topology

Local backend development uses [`docker-compose.yml`](../docker-compose.yml). The Compose stack starts:

- `user-service` on `3001`
- `question-service` on `3002`
- `matching-service` on `3003`
- `collaboration-service` on `3004`
- `rabbitmq` on `5672`
- RabbitMQ management UI on `15672`

Redis remains external in local development. `matching-service` and `collaboration-service` both connect to the Redis instance described in the root `.env`.

The frontend runs separately with `npm run dev` from [`frontend/`](../frontend/).

### Local container build model

Each backend service uses a single multi-stage Dockerfile:

- the `dev` stage is used by Docker Compose for local development
- the final production stage is used for deployable container images

This keeps local container development and production image generation aligned without maintaining separate Dockerfiles per service.

### Local startup model

There are two supported local workflows.

Integrated backend workflow:

- run `docker compose up --build` from the repository root

Targeted service workflow:

- run `npm run dev` inside an individual service directory
- use that service's local `.env` file

Frontend workflow:

- run `npm run dev` inside [`frontend/`](../frontend/)
- use `frontend/.env.local`

### Local environment files

The local environment model is split by responsibility:

- root `.env`: Docker Compose orchestration values
- `services/*/.env`: service-local runtime values for direct service execution
- `frontend/.env.local`: frontend build-time development values

## Cloud Deployment

### Cloud topology

The cloud deployment uses:

- S3 for frontend asset hosting
- CloudFront for frontend delivery
- ECS Fargate for backend services
- an ALB for public API ingress
- Nginx as the public backend gateway
- Redis as an external managed dependency
- RabbitMQ as an external managed dependency
- Supabase as an external managed dependency

The public entrypoints are:

- frontend: CloudFront distribution backed by S3
- backend API and websocket entrypoint: ALB -> Nginx

The backend services run privately behind Nginx:

- `user-service`
- `question-service`
- `matching-service`
- `collaboration-service`

### Cloud request flow

The cloud request path is:

1. Browser requests the frontend from CloudFront.
2. CloudFront serves the built frontend assets from S3.
3. Browser API and websocket requests go to the public API domain.
4. The ALB forwards traffic to the Nginx service.
5. Nginx routes requests to the correct ECS backend service.
6. Backend services connect to Supabase, Redis, and RabbitMQ using runtime configuration injected by the platform.

### Realtime traffic in cloud

Both `matching-service` and `collaboration-service` use Socket.IO. Cloud deployment therefore requires:

- WebSocket upgrade support through ALB and Nginx
- stable public websocket endpoints exposed by the gateway
- Redis and RabbitMQ connectivity from private backend services

The current application model is safest when these realtime services run as single replicas unless cross-instance Socket.IO coordination is added.

## Build and Packaging

### Frontend build

The frontend is built from [`frontend/`](../frontend/) and produces static assets for S3 upload. It consumes public `VITE_*` configuration at build time.

### Backend builds

Each backend service is packaged as an independent container image. The service Dockerfiles install dependencies, build the TypeScript application, and produce a runtime image for deployment.

The current services with container images are:

- [`services/user-service/Dockerfile`](../services/user-service/Dockerfile)
- [`services/question-service/Dockerfile`](../services/question-service/Dockerfile)
- [`services/matching-service/Dockerfile`](../services/matching-service/Dockerfile)
- [`services/collaboration-service/Dockerfile`](../services/collaboration-service/Dockerfile)

## Environment Variables

### Root Compose environment

The file [.env.example](../.env.example) defines the variables used by Docker Compose.

Required categories:

- local published ports:
  - `USER_SERVICE_PORT`
  - `QUESTION_SERVICE_PORT`
  - `MATCHING_SERVICE_PORT`
  - `COLLAB_SERVICE_PORT`
- shared backend infrastructure:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `REDIS_USERNAME`
  - `REDIS_PASSWORD`
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `RABBITMQ_URL`
- collaboration-specific local overrides:
  - `COLLAB_FRONTEND_ORIGIN`
  - `COLLAB_PUBLIC_WS_URL`
  - `COLLAB_GRACE_PERIOD_MS`
  - `COLLAB_JOIN_TOKEN_TTL_MS`
  - `RABBITMQ_MATCH_FOUND_EXCHANGE`
  - `RABBITMQ_MATCH_FOUND_QUEUE`
  - `RABBITMQ_MATCH_FOUND_ROUTING_KEY`
- shared defaults:
  - `LOG_LEVEL`

### Frontend environment

[`frontend/.env.local.example`](../frontend/.env.local.example) defines the frontend variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_USER_SERVICE_URL`
- `VITE_QUESTION_SERVICE_URL`
- `VITE_MATCHING_WS_URL`
- `VITE_COLLAB_WS_URL`

These are public build-time values and are safe to expose to the browser.

### user-service environment

[`services/user-service/.env.example`](../services/user-service/.env.example)

Required values:

- `PORT`
- `NODE_ENV`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### question-service environment

[`services/question-service/.env.example`](../services/question-service/.env.example)

Required values:

- `PORT`
- `NODE_ENV`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### matching-service environment

[`services/matching-service/.env.example`](../services/matching-service/.env.example)

Required values:

- `PORT`
- `NODE_ENV`
- `QUESTION_SERVICE_URL`
- `MATCHING_TIMEOUT_MS`
- `LOG_LEVEL`
- `REDIS_USERNAME`
- `REDIS_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `RABBITMQ_URL`

### collaboration-service environment

[`services/collaboration-service/.env.example`](../services/collaboration-service/.env.example)

Required values:

- `PORT`
- `NODE_ENV`
- `FRONTEND_ORIGIN`
- `PUBLIC_WS_URL`
- `GRACE_PERIOD_MS`
- `JOIN_TOKEN_TTL_MS`
- `LOG_LEVEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `REDIS_USERNAME`
- `REDIS_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `RABBITMQ_URL`
- `RABBITMQ_MATCH_FOUND_EXCHANGE`
- `RABBITMQ_MATCH_FOUND_QUEUE`
- `RABBITMQ_MATCH_FOUND_ROUTING_KEY`

### Cloud environment handling

In cloud deployment:

- frontend `VITE_*` values are injected during the frontend build
- backend service variables are injected at runtime by the deployment platform
- secrets are stored outside the repository

## CI Pipeline

The current CI workflow is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

It contains three validation layers.

### 1. Formatting

The root job installs root dependencies and runs:

- `npm run format:check`

### 2. Package validation

The package matrix installs and validates:

- `frontend`
- `user-service`
- `question-service`
- `matching-service`
- `collaboration-service`

For each package, CI runs:

- dependency installation with `npm ci`
- `npm run typecheck`
- `npm run build`

Coverage-enabled packages also run:

- `npm run test:coverage`

Current coverage uploads are enabled for:

- `user-service`
- `question-service`

Coverage reports are uploaded directly to Codecov during the same job.

### 3. Docker image validation

CI also builds container images for:

- `user-service`
- `question-service`
- `matching-service`
- `collaboration-service`

This verifies that each deployable backend image can be built successfully from the current repository state.

## CD Pipeline

The CD pipeline is defined in [`.github/workflows/cd.yml`](../.github/workflows/cd.yml).

### Trigger

The workflow runs in two modes:

- automatically after the CI workflow completes successfully on `main`
- manually via workflow dispatch in the GitHub Actions UI

The automatic trigger uses `workflow_run` to chain CI and CD. The workflow checks that CI concluded successfully before proceeding. Manual dispatch bypasses this check for re-deploys.

A concurrency group (`cd-production`) prevents overlapping deploys. If a second deploy is triggered while one is running, it queues rather than cancels the in-progress deploy.

### Authentication

The workflow authenticates with AWS using OIDC federation. GitHub Actions assumes an IAM role directly without stored long-lived credentials.

Required permissions:

- `id-token: write` for OIDC token exchange
- `contents: read` for repository checkout

### Job structure

The workflow has four jobs:

```
build-backend ──> deploy-backend
                                   (independent)
build-frontend ─> deploy-frontend
```

The two build jobs run in parallel. Each deploy job runs after its corresponding build job completes.

### Backend CD flow

#### Build phase

The `build-backend` job builds all five container images in parallel using a matrix strategy:

| Service                | Docker context              | Dockerfile                             |
| ---------------------- | --------------------------- | -------------------------------------- |
| `user-service`         | `services/user-service`     | `services/user-service/Dockerfile`     |
| `question-service`     | `services/question-service` | `services/question-service/Dockerfile` |
| `matching-service`     | `.` (repo root)             | `services/matching-service/Dockerfile` |
| `collaboration-service`| `services/collaboration-service` | `services/collaboration-service/Dockerfile` |
| `nginx`                | `nginx`                     | `nginx/Dockerfile`                     |

`matching-service` uses the repository root as its Docker context because its Dockerfile copies shared modules from the `shared/` directory.

Each image is tagged with the git commit SHA and pushed to ECR:

```
<account-id>.dkr.ecr.<region>.amazonaws.com/peerprep/<service>:<git-sha>
```

#### Deploy phase

The `deploy-backend` job deploys all five ECS services sequentially in this order:

1. `nginx`
2. `user-service`
3. `question-service`
4. `matching-service`
5. `collaboration-service`

Infrastructure goes first, then stateless services, then services with Redis and RabbitMQ dependencies.

For each service, the deploy:

1. Fetches the current ECS task definition
2. Renders a new task definition revision with the updated image tag
3. Registers the new task definition and updates the ECS service
4. Waits for ECS service stability before proceeding to the next service

### Frontend CD flow

#### Build phase

The `build-frontend` job:

1. Checks out the repository
2. Sets up Node 24
3. Installs dependencies with `npm ci`
4. Builds the frontend with production `VITE_*` environment variables injected from GitHub secrets
5. Uploads the `frontend/dist/` output as a workflow artifact

#### Deploy phase

The `deploy-frontend` job:

1. Downloads the build artifact
2. Syncs the assets to S3 with `aws s3 sync --delete`
3. Invalidates the CloudFront cache with path `/*`

The `--delete` flag removes stale assets from S3 that are no longer part of the build output.

### GitHub configuration

The following must be configured in the repository's GitHub settings.

#### Secrets

| Secret                       | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `AWS_ROLE_ARN`               | IAM role for OIDC federation               |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution for cache invalidation |
| `VITE_SUPABASE_URL`          | Frontend build-time Supabase URL           |
| `VITE_SUPABASE_ANON_KEY`     | Frontend build-time Supabase anon key      |
| `VITE_USER_SERVICE_URL`      | Frontend build-time user service URL       |
| `VITE_QUESTION_SERVICE_URL`  | Frontend build-time question service URL   |
| `VITE_MATCHING_WS_URL`       | Frontend build-time matching WebSocket URL |
| `VITE_COLLAB_WS_URL`         | Frontend build-time collab WebSocket URL   |

#### Variables

| Variable         | Purpose              |
| ---------------- | -------------------- |
| `AWS_REGION`     | AWS region            |
| `AWS_ACCOUNT_ID` | AWS account number    |

### AWS resource naming

The workflow uses the following provisional resource names. These are defined in the workflow's top-level `env` block and can be updated to match the actual infrastructure.

- ECR repositories: `peerprep/user-service`, `peerprep/question-service`, `peerprep/matching-service`, `peerprep/collaboration-service`, `peerprep/nginx`
- ECS cluster: `peerprep`
- ECS services: `peerprep-user-service`, `peerprep-question-service`, `peerprep-matching-service`, `peerprep-collaboration-service`, `peerprep-nginx`
- S3 bucket: `peerprep-frontend`

### Platform requirements for CD

The CD workflow depends on:

- ECR repositories for deployable images
- an ECS cluster and ECS services
- an S3 bucket for frontend assets
- a CloudFront distribution
- an IAM role with an OIDC trust policy scoped to this repository
- external Redis, RabbitMQ, and Supabase endpoints available to the runtime services

## Operational Summary

Local development uses Docker Compose for the backend stack, a separately started frontend, an external Redis instance, and a local RabbitMQ container.

Cloud deployment uses static frontend hosting through S3 and CloudFront, containerized backend services on ECS Fargate, Nginx as the backend gateway, and external managed integrations for Supabase, Redis, and RabbitMQ.
