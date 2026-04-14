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
- [Local Development](#local-development)
- [Build, Test, and Typecheck](#build-test-and-typecheck)
- [Docker and Deployment](#docker-and-deployment)
- [CI/CD](#cicd)
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
| `docs/DEPLOYMENT_GUIDE.md`        | Detailed local/cloud deployment notes                                |
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
- Collaboration overrides: `COLLAB_FRONTEND_ORIGIN`, `COLLAB_PUBLIC_WS_URL`, `COLLAB_GRACE_PERIOD_MS`, `COLLAB_JOIN_TOKEN_TTL_MS`, `RABBITMQ_MATCH_FOUND_EXCHANGE`, `RABBITMQ_MATCH_FOUND_QUEUE`, `RABBITMQ_MATCH_FOUND_ROUTING_KEY`
- Logging: `LOG_LEVEL`

### Frontend `.env.local` keys

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GATEWAY_URL`
- `VITE_MATCHING_WS_PATH`
- `VITE_COLLAB_WS_PATH`

---

## Local Development

### Prerequisites

- Node.js **24.x**
- npm
- Docker + Docker Compose
- Reachable Supabase project
- Reachable Redis instance

### 1. Install dependencies

```bash
npm ci
npm ci --prefix frontend
npm ci --prefix services/user-service
npm ci --prefix services/question-service
npm ci --prefix services/matching-service
npm ci --prefix services/collaboration-service
```

### 2. Configure environment files

```bash
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
cp services/user-service/.env.example services/user-service/.env
cp services/question-service/.env.example services/question-service/.env
cp services/matching-service/.env.example services/matching-service/.env
cp services/collaboration-service/.env.example services/collaboration-service/.env
```

Fill in your real Supabase/Redis values.

### 3. Start backend stack (gateway + services + RabbitMQ)

```bash
docker compose up --build
```

### 4. Start frontend

```bash
npm run dev --prefix frontend
```

Frontend default URL: `http://localhost:5173`  
Gateway default URL: `http://localhost:8080`

---

## Build, Test, and Typecheck

### Root-level scripts

```bash
npm run format:check
npm run format
npm run build
npm run typecheck
```

Root `build` and `typecheck` run across frontend + all backend services.

### Package-level scripts

### Frontend

```bash
npm run dev --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

### User Service

```bash
npm run dev --prefix services/user-service
npm run typecheck --prefix services/user-service
npm run test --prefix services/user-service
npm run test:coverage --prefix services/user-service
npm run build --prefix services/user-service
```

### Question Service

```bash
npm run dev --prefix services/question-service
npm run typecheck --prefix services/question-service
npm run test --prefix services/question-service
npm run test:coverage --prefix services/question-service
npm run build --prefix services/question-service
```

### Matching Service

```bash
npm run dev --prefix services/matching-service
npm run typecheck --prefix services/matching-service
npm run test --prefix services/matching-service
npm run test:coverage --prefix services/matching-service
npm run build --prefix services/matching-service
```

### Collaboration Service

```bash
npm run dev --prefix services/collaboration-service
npm run typecheck --prefix services/collaboration-service
npm run test --prefix services/collaboration-service
npm run build --prefix services/collaboration-service
```

---

## Docker and Deployment

### Local Docker Compose services

- `nginx`
- `user-service`
- `question-service`
- `matching-service`
- `collaboration-service`
- `rabbitmq` (+ management UI on `15672`)

### Dockerfile model

Each backend service uses a multi-stage Dockerfile:

- `dev` stage for local iterative development
- `build` stage for TypeScript compilation
- `prod` stage for runtime image

`matching-service` uses repo-root Docker context to include `shared/`.

---

## CI/CD

### CI (`.github/workflows/ci.yml`)

1. **Format Check** (`npm run format:check`)
2. **Package Matrix** (frontend + all services):
   - `npm ci`
   - `npm run typecheck`
   - tests/coverage where configured
   - `npm run build`
3. **Docker Build Matrix** for backend images

### CD (`.github/workflows/cd.yml`)

- Triggered by successful CI on `main` or manual dispatch
- Builds/pushes ECR images for:
  - `user-service`
  - `question-service`
  - `matching-service`
  - `collaboration-service`
  - `nginx`
- Deploys ECS services sequentially
- Builds frontend and deploys static assets to S3
- Invalidates CloudFront cache

For full deployment topology and required AWS/GitHub configuration, see `docs/DEPLOYMENT_GUIDE.md`.

---

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

- Deployment details: [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md)
- Matching service notes: `services/matching-service/README.md`, `services/matching-service/docs/`
- Collaboration service deep-dive: `services/collaboration-service/README.md`
