# PeerPrep Deployment Plan

## Scope and Assumptions

This deployment plan assumes:

- the frontend is fully implemented and production-ready
- the backend services are fully implemented and production-ready
- `nginx` is used as the API gateway
- Supabase remains an external managed dependency
- Redis remains external or is moved to AWS-managed Redis later

## Current Baseline

The branch currently has:

- local Docker Compose orchestration for backend development
- service-level `.env.example` files for direct service runs
- a root `.env.example` for Compose-driven local orchestration
- CI coverage for the current service set, including `collaboration-service`
- Docker build validation for the current backend services

The branch does not yet include:

- an `nginx` service or config
- AWS CD automation
- a local Redis container

## Deployable Units

The system is deployed as six independent units:

1. `frontend`
2. `nginx` API gateway
3. `user-service`
4. `question-service`
5. `matching-service`
6. `collaboration-service`

Each backend service and the gateway should have its own image, runtime config, logs, and deployment lifecycle.

## Target Architecture

### Public entrypoints

- `app.peerprep.com` -> `CloudFront` -> `S3`
- `api.peerprep.com` -> `Application Load Balancer` -> `nginx`

### Internal flow

- frontend assets are served from S3 through CloudFront
- API traffic enters through the ALB
- the ALB forwards API traffic to the `nginx` ECS service
- `nginx` proxies traffic to private ECS services

### Backend routing

`nginx` should route by path:

- `/api/users/*` -> `user-service`
- `/api/questions/*` -> `question-service`
- `/api/match/*` and matching websocket endpoints -> `matching-service`
- `/api/collab/*` and collaboration websocket endpoints -> `collaboration-service`

The frontend should only talk to one backend base URL:

- `https://api.peerprep.com`

## AWS Services

Use the following AWS components:

- `Amazon S3` for frontend static asset hosting
- `Amazon CloudFront` for frontend CDN delivery
- `Amazon Route 53` for DNS
- `AWS Certificate Manager (ACM)` for TLS certificates
- `Amazon ECS Fargate` for containerized backend and gateway services
- `Amazon ECR` for container image storage
- `AWS Secrets Manager` for secrets and runtime credentials
- `Amazon CloudWatch` for logs, metrics, and alarms
- `Application Load Balancer` for public API ingress

## Networking

### VPC layout

Create one VPC with:

- public subnets for the ALB
- private subnets for all ECS services

### Security boundaries

- ALB accepts inbound `80` and `443` from the internet
- `nginx` accepts traffic only from the ALB
- backend services accept traffic only from `nginx`
- backend services are not directly exposed to the internet

### Service discovery

Use ECS Service Connect or Cloud Map so `nginx` can reach backend services by stable internal names.

## Local Development

### Local orchestration

For local development, `docker-compose.yml` should be treated as a local-only stack and not as production deployment configuration.

The current local backend stack includes:

- `user-service` -> `3001`
- `question-service` -> `3002`
- `matching-service` -> `3003`
- `collaboration-service` -> `3004`
- `rabbitmq` -> `5672` and `15672`

Redis remains external in the current local setup.

### Local configuration source

Local configuration follows this split:

- root `.env` for Docker Compose orchestration
- per-service `.env` files for direct `npm run dev` execution
- `frontend/.env.local` for frontend development

The tracked root `.env.example` documents the expected local Compose variables for:

- Supabase URLs and service keys
- Redis connectivity
- RabbitMQ connectivity
- local host port mappings

Per-service `.env.example` files document the runtime contract for each individual service.

## Frontend Deployment

### Hosting model

The frontend is a static SPA built with Vite and deployed to:

- `S3` for artifact storage
- `CloudFront` for public delivery

### Build and publish flow

1. run `npm ci` in `frontend/`
2. run `npm run build`
3. upload `frontend/dist` to the S3 bucket
4. invalidate CloudFront cache

### SPA routing requirement

CloudFront and S3 must be configured so unknown paths return `index.html`, otherwise direct refreshes on client-side routes such as `/login` or `/match` will fail.

## Backend Deployment

### ECS services

Deploy each backend component as its own ECS Fargate service:

1. `nginx`
2. `user-service`
3. `question-service`
4. `matching-service`
5. `collaboration-service`

Each service should have:

- its own task definition
- its own CPU and memory configuration
- its own health check path
- its own log group
- its own scaling settings

### Initial scaling recommendation

- `nginx`: 2 tasks across availability zones if possible
- `user-service`: 1-2 tasks
- `question-service`: 1-2 tasks
- `matching-service`: start with 1 task
- `collaboration-service`: start with 1 task unless multi-instance coordination is already solved

### Real-time service caution

Both `matching-service` and `collaboration-service` may use WebSockets or other real-time connections.

Before scaling either horizontally, confirm:

- event delivery is safe across multiple instances
- shared state coordination exists where needed
- websocket upgrade handling is correct through ALB and `nginx`
- idle and proxy timeouts are aligned

If multi-instance socket coordination is not implemented, keep these services at a single task initially.

## API Gateway Design

### Why `nginx`

`nginx` acts as a centralized API boundary for:

- path routing
- request logging
- header management
- websocket forwarding
- rate limiting if added later
- keeping backend services private

### Deployment model

`nginx` should run as its own ECS service, not bundled into another backend service.

### Responsibilities

`nginx` should remain a thin gateway. Business logic and authorization decisions should still be enforced inside the backend services.

## Container and Image Strategy

Create one ECR repository per deployable backend unit:

1. `peerprep-nginx`
2. `peerprep-user-service`
3. `peerprep-question-service`
4. `peerprep-matching-service`
5. `peerprep-collaboration-service`

Images should be tagged with:

- git commit SHA
- optionally a semantic version tag later

Use immutable image tags for deployments so rollbacks are predictable.

## Secrets and Configuration

Do not deploy `.env` files to AWS.

Store runtime secrets in AWS Secrets Manager.

### Expected secret categories

- Supabase service credentials
- Redis credentials
- service-specific runtime config
- any API keys used by collaboration or real-time components

### Suggested secret grouping

- `/peerprep/prod/user-service`
- `/peerprep/prod/question-service`
- `/peerprep/prod/matching-service`
- `/peerprep/prod/collaboration-service`
- `/peerprep/prod/nginx`

Inject these into ECS task definitions at runtime.

Frontend public variables should be provided at build time and must not include backend-only secrets.

## CI/CD Plan

### CI

The repo currently has CI for:

- formatting checks
- package typecheck/build checks for:
  - `frontend`
  - `user-service`
  - `question-service`
  - `matching-service`
  - `collaboration-service`
  - `shared/rabbitmq`
- `question-service` test and coverage execution
- Docker build validation for:
  - `user-service`
  - `question-service`
  - `matching-service`
  - `collaboration-service`

Target CI after `nginx` is added should also validate the gateway image.

Suggested package-level CI checks:

- `frontend`: `npm ci && npm run build`
- `user-service`: `npm ci && npm run build`
- `question-service`: `npm ci && npm run build`
- `matching-service`: `npm ci && npm run build`
- `collaboration-service`: `npm ci && npm run build`
- `shared/rabbitmq`: `npm ci && npm run build`

### CD

On merge to `main`:

1. build backend and gateway images
2. tag images with commit SHA
3. push images to ECR
4. update ECS services to the new image versions
5. build the frontend
6. upload the frontend build to S3
7. invalidate CloudFront

### Rollback strategy

- rollback backend by redeploying the previous ECR image tag
- rollback frontend by restoring the previous S3 artifact set and invalidating CloudFront

## Operational Requirements

### Logging

Send ECS container logs to CloudWatch for:

- `nginx`
- `user-service`
- `question-service`
- `matching-service`
- `collaboration-service`

### Health checks

Add:

- ALB health checks for `nginx`
- ECS container health checks where applicable
- application-level `/health` endpoints for all services

### Monitoring and alerting

Add alarms for:

- ECS task failures
- high ALB 5xx response rates
- sustained high latency
- unusual disconnect or websocket error rates on real-time services

## Deployment Sequence

Implement in this order:

1. standardize Dockerfiles and production run commands
2. create a dedicated `nginx` container and routing config
3. create ECR repositories
4. create the ECS cluster and networking
5. deploy private backend ECS services
6. deploy the `nginx` ECS service
7. create the ALB and attach `nginx`
8. deploy the frontend to S3 + CloudFront
9. wire Route 53 and ACM
10. add GitHub Actions CI/CD
11. add CloudWatch alarms and rollback runbooks

## Expected Deliverables

The final deployment setup should include:

- production Dockerfiles for all deployable services
- `nginx` configuration for routing and websocket support
- ECR repositories
- ECS task definitions and services
- ALB listener and target group configuration
- S3 and CloudFront frontend hosting
- Route 53 DNS records
- ACM certificates
- Secrets Manager secret sets
- GitHub Actions workflows for CI/CD
- a rollback procedure

## Summary

The recommended production deployment is:

- frontend on `S3 + CloudFront`
- backend traffic through `ALB -> nginx`
- private ECS Fargate services for:
  - `user-service`
  - `question-service`
  - `matching-service`
  - `collaboration-service`

This keeps the frontend static and cheap to host, keeps all backend services independently deployable, and gives you one controlled API boundary without taking on Kubernetes complexity.
