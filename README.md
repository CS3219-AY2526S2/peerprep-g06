# PeerPrep

PeerPrep is a microservice-based interview practice platform where users:

1. Sign in with Supabase auth
2. Choose **difficulty + topic + language**
3. Enter a realtime queue
4. Get matched with another user
5. Collaborate in a live pair-programming session with shared editor sync

The repository is a monorepo containing a Vite frontend, four backend services, a gateway (Nginx), shared contracts, and CI/CD workflows.

---

## Table of Contents

- [System Overview](#system-overview)
- [Repository Structure](#repository-structure)
- [Architecture and Runtime Flow](#architecture-and-runtime-flow)
- [Services](#services)
- [API Contracts](#api-contracts)
- [Socket Events](#socket-events)
- [Environment Configuration](#environment-configuration)
- [Local Deployment](#local-deployment)
- [Build, Test, and Typecheck](#build-test-and-typecheck)
- [CI/CD](#cicd)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## System Overview

### Core Product Capabilities

- **Auth and profile management** via Supabase
- **Role-based features** (`user`, `admin`, `developer`)
- **Question bank management** (admin/developer)
- **Matchmaking queue** with timeout and reconnection support
- **Match handoff** over RabbitMQ
- **Collaboration session bootstrap** with per-user join tokens
- **Realtime collaborative coding** using Socket.IO + Yjs
- **History page** for past attempts

### External Dependencies

- **Supabase**: authentication + persistent data (`profiles`, `questions`, `admin_requests`, `history`)
- **Redis**: transient queue/session/presence state
- **RabbitMQ**: async event transport between matching and collaboration services

---

## Repository Structure

| Path                              | Purpose                                                              |
| --------------------------------- | -------------------------------------------------------------------- |
| `frontend/`                       | React + Vite + TypeScript UI                                         |
| `services/user-service/`          | Profile + admin/demote request APIs                                  |
| `services/question-service/`      | Question CRUD + random question selection APIs                       |
| `services/matching-service/`      | Queueing + matching + websocket matchmaking                          |
| `services/collaboration-service/` | Match event consumer + session lifecycle + collaborative editor sync |
| `nginx/`                          | Gateway routing for HTTP and websocket traffic                       |
| `shared/`                         | Shared cross-service/frontend contracts and constants                |
| `.github/workflows/`              | CI and CD pipelines                                                  |
| `docker-compose.yml`              | Local backend stack orchestration                                    |

---

## Architecture and Runtime Flow

### High-Level Topology

```text
Browser (frontend)
   |
   v
Nginx Gateway (:8080 default)
   |-- /users* -----------------> user-service (:3001) ------> Supabase
   |-- /questions* -------------> question-service (:3002) --> Supabase
   |-- /matching/socket.io* ----> matching-service (:3003) --> Redis, RabbitMQ, question-service
   |-- /collaboration/socket.io* -> collaboration-service (:3004) --> Redis, RabbitMQ, Supabase
```

### Match-to-Session Sequence

1. Frontend opens matching socket and emits `join_queue`.
2. Matching service stores queue state in Redis.
3. On compatible pair found, matching service fetches a random question from question-service.
4. Matching service publishes `match.found` event to RabbitMQ exchange `peerprep`.
5. Collaboration service consumes event and creates a session seed in Redis.
6. Collaboration service generates per-user join tokens and `session-ready` payloads.
7. If user notification socket is connected, payload is pushed immediately; otherwise queued in Redis for replay.
8. Frontend connects to `/session` namespace with access token + `sessionId` + `joinToken`.
9. Collaboration service authenticates, restores document snapshot, emits `session:joined` + `doc:sync`.
10. Participants exchange incremental Yjs updates through `doc:update`.

---

## Services

### Frontend (`frontend`)

### Stack

- React 18 + TypeScript
- Vite
- Zustand (client store)
- Supabase JS client
- Socket.IO client
- Monaco Editor + Yjs integration

### Routes

- Public: `/`, `/login`, `/signup`
- Protected: `/match`, `/queue`, `/account`, `/session/:sessionId`, `/history`
- Developer-only: `/dev-panel`
- Admin/Developer feature entry: `/questions`

### Key frontend behaviors

- Auth state managed through `AuthContext` and synced with `profiles` role data.
- Match preferences are selected in `MatchingSetup`.
- Queue flow handled by `useMatchmaking`.
- Session-ready notifications handled by `useCollabNotifications`.
- Live session state + reconnect/grace handling handled by `useCollabSession`.
- Pending collaboration session is persisted in local/session storage (`peerprep.pendingSession`).

---

### User Service (`services/user-service`)

### Responsibilities

- Health check
- Profile retrieval
- Display-name lookup by user ID
- Admin promotion and demotion request lifecycle

### Integrations

- Supabase auth validation
- Supabase tables: `profiles`, `admin_requests`

---

### Question Service (`services/question-service`)

### Responsibilities

- List all questions
- Get question by ID
- Get random question by difficulty + topic
- Add/update/delete questions (role-gated)

### Integrations

- Supabase tables: `questions`, `profiles` (for role checks via middleware)

---

### Matching Service (`services/matching-service`)

### Responsibilities

- Accept matchmaking queue joins/cancels over websocket
- Maintain queue and request state in Redis
- Handle reconnects (`queue_rejoined`) using request TTL
- Periodically scan queues and attempt matches
- Create match records, mark matched users, emit `match_found`
- Publish match events to RabbitMQ for collaboration handoff

### Notes

- Queue keys are partitioned by difficulty + language: `queue:<difficulty>:<language>`
- Timeout path emits `timeout` after request expiry events from Redis keyspace notifications
- Uses shared contracts from `shared/types.ts`

---

### Collaboration Service (`services/collaboration-service`)

### Responsibilities

- Consume `match.found` events from RabbitMQ
- Create idempotent session seeds in Redis
- Create and verify join tokens
- Deliver/queue `session-ready` notifications
- Authenticate notification and session sockets via Supabase token lookup
- Coordinate participant status (`connected`, `disconnected`, `left`)
- Handle reconnect grace periods and cleanup when both users leave
- Synchronize editor state via Yjs document updates and Redis snapshots

### Important internal design points

- Match-level lock prevents duplicate session creation.
- Pending notifications are indexed per user for replay after reconnect.
- Join tokens are stored hashed for verification.
- Document snapshots migrate from initial plain-text seed to `yjs-update-base64`.

---

## API Contracts

Base URL (through gateway): `http://localhost:8080`

### Health Endpoints

| Service       | Endpoint                    | Response                                                               |
| ------------- | --------------------------- | ---------------------------------------------------------------------- |
| Gateway       | `GET /gateway/health`       | plain text `ok`                                                        |
| User          | `GET /users/health`         | `{ "status": "User service is running" }`                              |
| Question      | `GET /questions/health`     | `{ "status": "ok" }`                                                   |
| Matching      | `GET /matching/health`      | `{ "message": "Matching service is running" }`                         |
| Collaboration | `GET /collaboration/health` | `{ "service": "collaboration-service", "status": "ok", "port": 3004 }` |

### User Service HTTP Routes

| Method | Route                                | Purpose                                     |
| ------ | ------------------------------------ | ------------------------------------------- |
| GET    | `/users/profile`                     | Get current user profile                    |
| GET    | `/users/profile/:userId`             | Get display name by user ID                 |
| POST   | `/users/:id/admin-request`           | Create promotion request                    |
| GET    | `/users/admin-requests`              | List pending promotion requests (developer) |
| PATCH  | `/users/admin-requests/:id/approve`  | Approve promotion request (developer)       |
| PATCH  | `/users/admin-requests/:id/reject`   | Reject promotion request (developer)        |
| POST   | `/users/:id/demote-request`          | Create demotion request (admin)             |
| GET    | `/users/demote-requests`             | List pending demotion requests (developer)  |
| PATCH  | `/users/demote-requests/:id/approve` | Approve demotion request (developer)        |
| PATCH  | `/users/demote-requests/:id/reject`  | Reject demotion request (developer)         |

### Question Service HTTP Routes

| Method | Route                                  | Purpose                           |
| ------ | -------------------------------------- | --------------------------------- |
| GET    | `/questions`                           | Get all questions                 |
| GET    | `/questions/:id`                       | Get one question                  |
| GET    | `/questions/random/:difficulty/:topic` | Get random filtered question      |
| POST   | `/questions/add`                       | Add question (admin/developer)    |
| PUT    | `/questions/:id/update`                | Update question (admin/developer) |
| DELETE | `/questions/:id/delete`                | Delete question (admin/developer) |

---

## Socket Events

Socket traffic is proxied through Nginx paths:

- Matching: `path=/matching/socket.io`
- Collaboration notification + session namespace: `path=/collaboration/socket.io`

### Matching Socket

### Client -> Server

- `join_queue` payload: `{ userId, difficulty, topics, language }`
- `cancel_queue` payload: `{ userId }`

### Server -> Client

- `match_found` payload: `{ matchId, question, peerId, difficulty, topic, language }`
- `queue_rejoined` payload: `{ timeLeft }`
- `queue_error` payload: `{ message }`
- `timeout` payload: `{ message }`

### Collaboration Notification Socket

### Client -> Server

- `notification:register` payload: `{ userId }`

### Server -> Client

- `session-ready` payload: `{ sessionId, userId, joinToken, gracePeriodMs, language, question, websocketUrl }`
- `notification:error` payload: `{ message }`

### Collaboration Session Namespace (`/session`)

### Client -> Server

- `doc:update` payload: `{ update }`
- `session:leave` (no payload)

### Server -> Client

- `session:joined`
- `doc:sync`
- `doc:update`
- `participant:status`
- `session:ended`
- `session:error`

---

## Environment Configuration

Root `.env` drives Docker Compose and shared local stack values.

Start from:

- `.env.example` (repository root)
- `frontend/.env.local.example`
- `services/*/.env.example` (for standalone service runs)

### Root `.env` (Compose) keys

- Ports: `NGINX_PORT`, `USER_SERVICE_PORT`, `QUESTION_SERVICE_PORT`, `MATCHING_SERVICE_PORT`, `COLLAB_SERVICE_PORT`
- Shared backends: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`, `RABBITMQ_URL`
- Collaboration overrides: `FRONTEND_ORIGIN`, `PUBLIC_WS_URL`, `GRACE_PERIOD_MS`, `JOIN_TOKEN_TTL_MS`, `RABBITMQ_MATCH_FOUND_EXCHANGE`, `RABBITMQ_MATCH_FOUND_QUEUE`, `RABBITMQ_MATCH_FOUND_ROUTING_KEY`
- Logging: `LOG_LEVEL`

### Frontend `.env.local` keys

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GATEWAY_URL`
- `VITE_MATCHING_WS_PATH`
- `VITE_COLLAB_WS_PATH`

---

## Local Deployment

PeerPrep runs locally as:

- frontend: Vite dev server from [`frontend/`](./frontend)
- backend gateway and services: Docker Compose from the repo root
- Supabase: external managed dependency
- Redis: external managed dependency
- RabbitMQ: local container via Docker Compose

### Prerequisites

- Docker and Docker Compose
- Node.js and npm
- accessible Supabase project
- accessible Redis instance

### Local Environment Files

Use these files for local development:

- root [`.env.example`](./.env.example)
  This drives Docker Compose for the gateway, backend services, and RabbitMQ.
- frontend [`frontend/.env.local.example`](./frontend/.env.local.example)
  This drives the frontend development build.
- service examples under [`services/`](./services)
  These are useful when running an individual service directly outside Docker Compose.

Create the real env files you need before startup. Do not commit real secrets.

### Local Startup

1. Fill in the root `.env` with local ports and shared dependency values.
2. Fill in `frontend/.env.local` with local frontend values.
3. Start the backend stack from the repository root:

```bash
docker compose up --build
```

4. In a separate shell, start the frontend:

```bash
npm run dev --prefix frontend
```

### Local Traffic Model

The frontend should talk to the local Nginx gateway, not directly to individual backend service ports.

Expected local gateway routes include:

- `/users/...`
- `/questions/...`
- `/history/...`
- `/matching/socket.io`
- `/collaboration/socket.io`

The gateway configuration lives in [`nginx/nginx.conf`](./nginx/nginx.conf).

---

## Build, Test, and Typecheck

### Root-level scripts

```bash
npm run format:check
npm run build
npm run typecheck
```

### Package-level scripts

```bash
# Frontend
npm run dev --prefix frontend
npm run build --prefix frontend

# Services
npm run dev --prefix services/user-service
npm run dev --prefix services/question-service
npm run dev --prefix services/matching-service
npm run dev --prefix services/collaboration-service
```

---

## CI/CD

### CI (`.github/workflows/ci.yml`)

CI runs:

1. Root formatting check (`npm run format:check`)
2. Matrix package validation (install, typecheck, tests/coverage where configured, build)
3. Docker image build validation for backend services

### CD (`.github/workflows/cd.yml`)

CD runs on successful CI on `main` (or manual dispatch) and does:

1. Build and push backend images (`user-service`, `question-service`, `matching-service`, `collaboration-service`, `nginx`) to ECR
2. Deploy ECS services using updated task definitions
3. Build frontend and deploy assets to S3
4. Invalidate CloudFront cache

For infrastructure details, refer to this README’s CI/CD and Production Deployment sections and the workflow files in `.github/workflows/`.

## Production Deployment

PeerPrep is currently deployed in the following shape:

- frontend: static hosting (S3 + CloudFront)
- backend: AWS ECS Fargate services behind Nginx
- backend public entrypoint: `https://api.neeg06code.com`
- backend ingress: ALB -> Nginx -> internal services
- external managed dependencies: Supabase, Redis, RabbitMQ

### Production Components

The deployable backend services are:

- `nginx`
- `user-service`
- `question-service`
- `matching-service`
- `collaboration-service`

The frontend is the Vite app in [`frontend/`](./frontend).

### Production Runtime Requirements

Frontend production build values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GATEWAY_URL=https://api.neeg06code.com`
- `VITE_MATCHING_WS_PATH=/matching/socket.io`
- `VITE_COLLAB_WS_PATH=/collaboration/socket.io`

Backend runtime requirements:

- `user-service`
  - `PORT=3001`
  - `NODE_ENV=production`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
- `question-service`
  - `PORT=3002`
  - `NODE_ENV=production`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
- `matching-service`
  - `PORT=3003`
  - `NODE_ENV=production`
  - `QUESTION_SERVICE_URL=http://question-service:3002`
  - `REDIS_USERNAME`
  - `REDIS_PASSWORD`
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `RABBITMQ_URL`
- `collaboration-service`
  - `PORT=3004`
  - `NODE_ENV=production`
  - `FRONTEND_ORIGIN=https://neeg06code.com`
  - `PUBLIC_WS_URL=https://api.neeg06code.com`
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

Do not store production secrets in the repository.

### Backend Deployment

1. Build and push backend images to ECR.
2. Update ECS task definitions with the new image tags and production env values.
3. Deploy ECS services.
4. Ensure the ALB forwards traffic to the Nginx service.
5. Ensure the ALB health check points at `/gateway/health`.
6. Ensure Nginx listens internally on port `80`.

Recommended backend rollout order:

1. `user-service`
2. `question-service`
3. `matching-service`
4. `collaboration-service`
5. `nginx`

### Frontend Deployment

Build the production frontend:

```bash
npm run build --prefix frontend
```

Deploy `frontend/dist` to your static hosting target (CD workflow uses S3 sync + CloudFront invalidation).

### Production Validation

After deployment, validate these in order:

1. `https://api.neeg06code.com/gateway/health`
2. `https://api.neeg06code.com/users/health`
3. `https://api.neeg06code.com/questions/health`
4. `https://api.neeg06code.com/matching/health`
5. `https://api.neeg06code.com/collaboration/health`
6. `https://neeg06code.com`
7. authenticated frontend flow
8. matchmaking websocket flow
9. collaboration websocket flow

## Troubleshooting

### Common local issues

- **Frontend cannot reach backend**
  - verify `VITE_GATEWAY_URL` points to gateway (default `http://localhost:8080`)
- **Matching queue never matches**
  - verify Redis credentials/connectivity and `QUESTION_SERVICE_URL`
- **No collaboration session after match**
  - verify RabbitMQ connection and exchange/queue/routing key alignment between matching and collaboration services
- **Session reconnect fails quickly**
  - verify `GRACE_PERIOD_MS` and join token TTL settings
- **Role-based pages inaccessible**
  - verify `profiles.role` in Supabase (`user` / `admin` / `developer`)

### Helpful links

- Matching service notes: `services/matching-service/README.md`, `services/matching-service/docs/`
- Collaboration service notes: `services/collaboration-service/README.md`
