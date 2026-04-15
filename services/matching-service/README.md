# Matching Service

Realtime matchmaking service for PeerPrep.  
It accepts queue requests over Socket.IO, manages queue state in Redis, fetches a random question, and publishes match handoff events to RabbitMQ.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then fill in:

- `REDIS_USERNAME`
- `REDIS_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `QUESTION_SERVICE_URL`
- `RABBITMQ_URL`
- optional `MATCHING_TIMEOUT_MS`, `LOG_LEVEL`, `PORT`, `NODE_ENV`

### 3. Run the Service

**Using Docker Compose:**

```bash
# From project root
docker compose up
```

**Using npm (Single-Service Development):**

```bash
npm run dev
```

The service will be available at `http://localhost:3003`

### 4. Test the Connection

```bash
curl http://localhost:3003/health

# Expected response:
# {"message":"Matching service is running"}
```

## API Endpoints

| Method | Route     | Auth | Description  |
| ------ | --------- | ---- | ------------ |
| GET    | `/health` | None | Health check |

## Socket Events

Socket path is configured at gateway level as `/matching/socket.io`.

### Client -> Server

- `join_queue`: `{ userId, difficulty, topics, language }`
- `cancel_queue`: `{ userId }`

### Server -> Client

- `match_found`: `{ matchId, question, peerId, difficulty, topic, language }`
- `queue_rejoined`: `{ timeLeft }`
- `queue_error`: `{ message }`
- `timeout`: `{ message }`

## Architecture

- **Express**: HTTP health endpoint
- **Socket.IO**: realtime matchmaking events
- **Redis**: queue membership, request state, locks, and timeout handling
- **RabbitMQ**: publishes match events (`match.found`) for collaboration handoff
- **Question Service**: provides random question by difficulty/topic
- **TypeScript**: typed services and handlers

## Development

### Type Checking

```bash
npm run typecheck
```

### Tests

```bash
npm test
npm run test:coverage
```

### Build

```bash
npm run build
```

## Troubleshooting

### Queue Timeout Behavior Not Triggering

If users are not timing out:

1. Verify Redis connection is healthy
2. Verify `MATCHING_TIMEOUT_MS` is set as expected
3. Ensure Redis keyspace notifications are enabled by service startup

### Question Fetch Failures

If matches are found but question retrieval fails:

1. Verify `QUESTION_SERVICE_URL` points to a reachable question service
2. Check question-service has data for requested difficulty/topic
3. Check matching service logs for upstream status codes

### Docker Container Logs

```bash
docker logs peerprep-matching-service
```
