# Collaboration Service

Realtime collaboration service for PeerPrep.  
It consumes match events from RabbitMQ, creates collaboration sessions in Redis, sends `session-ready` notifications, and syncs shared editor updates with Socket.IO + Yjs.

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

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `REDIS_USERNAME`
- `REDIS_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `RABBITMQ_URL`
- optional `RABBITMQ_MATCH_FOUND_*`, `FRONTEND_ORIGIN`, `PUBLIC_WS_URL`, `GRACE_PERIOD_MS`, `JOIN_TOKEN_TTL_MS`, `LOG_LEVEL`, `PORT`, `NODE_ENV`

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

The service will be available at `http://localhost:3004`

### 4. Test the Connection

```bash
curl http://localhost:3004/health

# Expected response:
# {"service":"collaboration-service","status":"ok","port":3004}
```

## API Endpoints

| Method | Route     | Auth | Description  |
| ------ | --------- | ---- | ------------ |
| GET    | `/health` | None | Health check |

## Socket Events

Socket path is configured at gateway level as `/collaboration/socket.io`.

### Notification Socket (`/`)

#### Client -> Server

- `notification:register`: `{ userId }` (optional compatibility no-op)

#### Server -> Client

- `session-ready`: `{ sessionId, userId, joinToken, gracePeriodMs, language, question, websocketUrl }`
- `notification:error`: `{ message }`

### Session Namespace (`/session`)

#### Client -> Server

- `doc:update`: `{ update }`
- `session:leave`: no payload

#### Server -> Client

- `session:joined`
- `doc:sync`
- `doc:update`
- `participant:status`
- `session:ended`
- `session:error`

## Architecture

- **Express**: HTTP health endpoint
- **Socket.IO**: notification channel and authenticated session namespace
- **Yjs**: collaborative document CRDT updates
- **Redis**: session metadata, join tokens, pending notifications, grace periods, and document snapshots
- **RabbitMQ**: consumes `match.found` events from matching service
- **Supabase Auth API**: validates access tokens for socket authentication
- **Supabase REST**: upserts per-user attempt history rows on session end
- **TypeScript**: typed contracts and service logic

## Attempt History Persistence

When a collaboration session ends, the service writes two rows to the Supabase `history` table:

- one row for `user1Id`
- one row for `user2Id`

The row shape should match the actual database model used by the rest of the app:

- `user_id uuid`
- `question_id bigint`
- `session_id text`
- `partner_id uuid`
- `solution text`

The upsert is intentionally idempotent and depends on the database constraint documented in [docs/history-table.sql](docs/history-table.sql):

- unique `(session_id, user_id)`

Without that constraint, the `on_conflict=session_id,user_id` write path in `src/services/attemptHistory.ts` is not guaranteed to deduplicate repeated session-end writes.

## Development

### Type Checking

```bash
npm run typecheck
```

### Tests

```bash
npm test
```

### Build

```bash
npm run build
```

## Troubleshooting

### Session-Ready Notifications Not Arriving

1. Verify RabbitMQ connectivity and `RABBITMQ_MATCH_FOUND_*` values
2. Verify collaboration service is subscribed to the expected exchange/routing key
3. Confirm users are connected on the notification socket

### Session Join Authentication Errors

If clients fail to join `/session`:

1. Verify Supabase credentials in env
2. Verify access token is valid and not expired
3. Verify `sessionId` and `joinToken` are from the latest `session-ready` payload

### Reconnect/Presence Issues

1. Verify `GRACE_PERIOD_MS` is configured correctly
2. Verify Redis is reachable and stable
3. Check participant status events and session logs

### Docker Container Logs

```bash
docker logs peerprep-collaboration-service
```

## Additional Documentation

- Full architecture & lifecycle: `docs/collaboration-service-handover.md`
