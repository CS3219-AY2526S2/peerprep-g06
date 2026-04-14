[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/HpD0QZBI)

# CS3219 Project (PeerPrep) - AY2526S2

## Group: G06

### Note:

- You are required to develop individual microservices within separate folders within this repository.
- The teaching team should be given access to the repositories, as we may require viewing the history of the repository in case of any disputes or disagreements.

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

## Production Deployment

PeerPrep is currently deployed in the following shape:

- frontend: Firebase Hosting on `https://neeg06code.com`
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

Firebase Hosting serves the built output from `frontend/dist`.

Build the production frontend from the repo root:

```bash
npm run build --prefix frontend
```

Deploy the static build:

```bash
firebase deploy --only hosting
```

The Firebase Hosting configuration lives in [`firebase.json`](./firebase.json).

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
