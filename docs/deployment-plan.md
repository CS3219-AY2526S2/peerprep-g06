# PeerPrep Deployment Plan

## Overview

This document captures two things:

- the deployment shape we are aiming for
- the repo state we already have in place before the Nginx work starts

The target production setup is:

- frontend hosted as a static app on `S3 + CloudFront`
- backend services deployed independently on `ECS Fargate`
- `nginx` used as the public API gateway
- Supabase kept as an external managed dependency
- Redis kept external for now, with the option to move to AWS-managed Redis later

We are deliberately not using Kubernetes at this stage. The service count does not justify the extra platform overhead yet.

## Where the Repo Stands Today

The repo already has a usable pre-gateway baseline.

Local development currently supports:

- `user-service`
- `question-service`
- `matching-service`
- `collaboration-service`
- `rabbitmq`

`docker-compose.yml` is now a local-only orchestration file. It is not meant to mirror production literally.

Current local defaults are:

- `user-service` on `3001`
- `question-service` on `3002`
- `matching-service` on `3003`
- `collaboration-service` on `3004`
- RabbitMQ on `5672` with the management UI on `15672`

Redis is still treated as an external dependency in local development. `matching-service` and `collaboration-service` both connect to the same Redis instance through environment variables.

The local env model is:

- root `.env` for `docker compose`
- per-service `.env` files for direct `npm run dev`
- `frontend/.env.local` for frontend development

CI is already in place and now covers the current backend shape. It runs formatting checks, typecheck/build validation across packages, question-service tests with coverage, and Docker image builds for the containerized backend services.

What is not in the repo yet:

- `nginx` config and container
- AWS CD workflow
- local Redis container

## Target Production Architecture

The intended production layout is straightforward.

Public entrypoints:

- `app.peerprep.com` -> `CloudFront` -> `S3`
- `api.peerprep.com` -> `ALB` -> `nginx`

Internal backend flow:

- `nginx` receives public API traffic
- `nginx` proxies to private backend services running on ECS
- backend services are not directly exposed to the internet

The backend services are:

1. `user-service`
2. `question-service`
3. `matching-service`
4. `collaboration-service`

`nginx` is a separate deployable unit and should not be bundled into any application service.

Expected routing through `nginx`:

- `/api/users/*` -> `user-service`
- `/api/questions/*` -> `question-service`
- matching API and websocket traffic -> `matching-service`
- collaboration API and websocket traffic -> `collaboration-service`

The frontend should talk to one backend base URL only.

## Why This Shape

This gives us:

- one public backend boundary
- independently deployable backend services
- a frontend that stays cheap and simple to host
- a deployment model that fits the current repo better than Kubernetes

It also lets us introduce `nginx` locally first, validate the routing and websocket behavior, and only then wire the same shape into AWS.

## Realtime and Messaging Constraints

Two services are realtime-sensitive:

- `matching-service`
- `collaboration-service`

Both use Socket.IO. That matters for deployment.

Right now, both services are safest as single-instance deployments unless we add cross-instance socket coordination. They use Redis for state, but there is no Socket.IO adapter in the repo yet for multi-instance room/event coordination.

There is also a backend event handoff:

- `matching-service` publishes match events
- `collaboration-service` consumes them through RabbitMQ

That means production needs three classes of infrastructure around the app:

- HTTP/WebSocket ingress
- Redis
- RabbitMQ

`nginx` is only responsible for routing traffic. It does not replace RabbitMQ, and it does not solve multi-instance Socket.IO coordination by itself.

## Environment Strategy

We should keep a clean split between local orchestration and service-specific runtime configuration.

For local development:

- root `.env` powers Compose
- service `.env` files are for running a service directly
- frontend uses `frontend/.env.local`

For production:

- no checked-in `.env` files
- runtime secrets come from AWS Secrets Manager
- frontend public config is injected at build time

Backend secrets include things like:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- Redis credentials
- RabbitMQ connection details

Frontend build-time variables include public values only, such as:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- public backend base URLs

## Local Development Model

There are two intended ways to work locally.

For integrated backend development:

- use `docker compose up`

This starts the backend services in containers and includes RabbitMQ. Redis is still expected to exist externally.

For targeted work on a single service:

- use `npm run dev` inside that service directory

In that mode, the service should read from its own local `.env` file.

For frontend work:

- use `npm run dev` in `frontend/`

This split is intentional. Dockerfiles exist to support Compose, CI image validation, and future AWS deployment. They are not mandatory for every local development flow.

## CI and CD

CI is already partially in place.

Today it validates:

- formatting at the repo root
- typecheck and build for:
  - `frontend`
  - `user-service`
  - `question-service`
  - `matching-service`
  - `collaboration-service`
  - `shared/rabbitmq`
- `question-service` tests and coverage
- Docker builds for:
  - `user-service`
  - `question-service`
  - `matching-service`
  - `collaboration-service`

CD is still intentionally paused until the AWS side is ready.

The expected CD shape later is:

- build backend images
- push them to ECR
- update ECS services
- build the frontend
- publish frontend assets to S3
- invalidate CloudFront

## AWS Plan

The intended AWS components are:

- `ECR` for images
- `ECS Fargate` for backend services and `nginx`
- `ALB` for public API ingress
- `S3 + CloudFront` for the frontend
- `Route 53` for DNS
- `ACM` for certificates
- `Secrets Manager` for backend secrets
- `CloudWatch` for logs and alarms

The networking model should be:

- ALB in public subnets
- `nginx` and backend services in private subnets
- backend services reachable only from `nginx`

## Rollout Order

The remaining work should happen in this order:

1. branch for `nginx`
2. add local `nginx` config
3. add the `nginx` container
4. wire `nginx` into local Compose
5. point frontend local traffic through the gateway where appropriate
6. create AWS resources for the target architecture
7. add CD once the AWS side exists

## Short Version

We already have the repo in a decent pre-gateway state.

The next step is not more baseline cleanup. It is introducing `nginx` locally, validating the routing model, and then carrying that same shape into AWS:

- static frontend on `S3 + CloudFront`
- public API through `ALB -> nginx`
- private ECS services behind it

That keeps the system simple enough to operate now while still leaving room to scale the architecture later.
