# Collaboration Service Handover

This README is meant to hand the collaboration service over to a completely new developer.

The goal is that someone can read this file, open the referenced source files, and understand:

1. what the service is responsible for
2. how the runtime flow works from match event to live session
3. what each file does from top to bottom
4. what other teams need to implement to integrate with this service
5. what the API gateway developer needs to know to front this service cleanly

This document describes the code as it exists in `services/collaboration-service` today.

## 1. What This Service Owns

The collaboration service owns the collaboration domain after matching has already found two users.

It is responsible for:

- consuming `MatchFound` events from RabbitMQ
- creating one collaboration session per matched pair
- generating per-user join tokens
- persisting short-lived collaboration state in Redis
- notifying matched users that a session is ready
- authenticating session joins
- synchronizing the shared document using Yjs
- handling leave, disconnect, reconnect, and grace-period expiry
- cleaning up the session when both participants are gone

It does not own:

- the queue or matching algorithm
- question selection logic
- browser routing
- Monaco setup in the frontend
- the API gateway

## 2. Current High-Level Flow

The current end-to-end backend flow is:

1. `matching-service` publishes a `MatchFound` event to RabbitMQ.
2. `collaboration-service` consumes the event.
3. `collaboration-service` creates a session in Redis.
4. `collaboration-service` creates two join tokens, one per user.
5. `collaboration-service` builds a `session-ready` payload for each user.
6. If the user is already connected to the notification socket, the service pushes `session-ready` immediately.
7. If the user is offline, the payload is stored in Redis and replayed when they reconnect.
8. The frontend connects to the session namespace using:
   - Supabase access token
   - `sessionId`
   - `joinToken`
9. The service verifies the user, restores the latest document state, and emits `session:joined` plus `doc:sync`.
10. Both users exchange incremental Yjs updates through `doc:update`.
11. If one user disconnects unexpectedly, they are marked `disconnected` and given a reconnect grace period.
12. If they reconnect in time, they resume the same session.
13. If they explicitly leave or their grace expires, they are marked `left`.
14. When both participants are `left`, the session ends and Redis state is deleted.

## 3. Folder Map

Relevant files:

- `package.json`
- `Dockerfile`
- `.env.example`
- `tsconfig.json`
- `src/index.ts`
- `src/config/env.ts`
- `src/config/rabbitmq.ts`
- `src/config/redis.ts`
- `src/lib/supabase.ts`
- `src/types/contracts.ts`
- `src/types/session.ts`
- `src/types/amqplib.d.ts`
- `src/utils/logger.ts`
- `src/services/sessionPersistence.ts`
- `src/services/sessionStore.ts`
- `src/services/notificationService.ts`
- `src/services/notificationSocket.ts`
- `src/services/realtimeTransport.ts`
- `src/services/matchFoundConsumer.ts`
- `src/services/documentSyncService.ts`
- `src/services/sessionSocket.ts`

Generated folders not meant for manual editing:

- `dist/`
- `node_modules/`

## 4. How To Run This Service

Local service commands:

- `npm run dev`
- `npm run build`
- `npm run start`

Required infrastructure:

- RabbitMQ
- Redis
- Supabase Auth

Required environment variables are documented in `.env.example`.

## 5. File-By-File Walkthrough

This section walks top-to-bottom through each file in the order a new developer should read them.

### 5.1 `package.json`

Purpose:

- defines this service as an independent Node package
- defines the runtime and build scripts
- lists the dependencies used by the service

Top to bottom:

1. `name`, `version`, `description`, `main` are standard package metadata.
2. `scripts.dev` runs the TypeScript service directly with `tsx watch`.
3. `scripts.build` compiles `src/` into `dist/`.
4. `scripts.start` runs the compiled JS output.
5. `dependencies`:
   - `amqplib`: RabbitMQ client
   - `cors`: Express CORS support
   - `dotenv`: environment loading
   - `express`: HTTP server
   - `redis`: Redis client
   - `socket.io`: realtime transport
   - `yjs`: CRDT document engine
6. `devDependencies` are the TypeScript/dev-only packages.

### 5.2 `Dockerfile`

Purpose:

- containerizes the service for Docker or Compose

Top to bottom:

1. starts from a Node Alpine image
2. sets `/app` as the working directory
3. copies `package*.json`
4. runs `npm install`
5. copies the rest of the source code
6. exposes the collaboration port
7. runs `npm run dev`

Note:

- this currently runs the dev watcher in the container, not the compiled production build

### 5.3 `.env.example`

Purpose:

- documents the env vars expected by this service

Variables:

- `COLLAB_SERVICE_PORT`
- `COLLAB_FRONTEND_ORIGIN`
- `COLLAB_PUBLIC_WS_URL`
- `COLLAB_GRACE_PERIOD_MS`
- `COLLAB_JOIN_TOKEN_TTL_MS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `RABBITMQ_URL`
- `RABBITMQ_MATCH_FOUND_EXCHANGE`
- `RABBITMQ_MATCH_FOUND_QUEUE`
- `RABBITMQ_MATCH_FOUND_ROUTING_KEY`
- `REDIS_USERNAME`
- `REDIS_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `LOG_LEVEL`

### 5.4 `src/index.ts`

Purpose:

- this is the main entrypoint that wires the whole service together

Read it top to bottom like this:

1. imports Express, HTTP, CORS, Socket.IO, and dotenv
2. imports local config and infrastructure helpers
3. imports the consumer, socket namespace configuration, and transport adapters
4. calls `dotenv.config()` so environment variables are available
5. creates the Express app
6. creates the raw HTTP server that Express and Socket.IO share
7. creates the notification Socket.IO server
8. attaches CORS config from `config.frontendOrigin`
9. enables JSON request parsing
10. creates the notification transport from the raw Socket.IO server
11. configures the notification namespace
12. creates the `/session` namespace
13. creates the session transport from that namespace
14. configures the session namespace
15. exposes `GET /health`
16. defines `bootstrap()`
17. in `bootstrap()`:
    - connect to Redis
    - connect to RabbitMQ
    - start the `MatchFound` consumer
    - start listening on the configured port
18. if bootstrap fails, log the error and exit the process

This file is the best place to understand the service composition.

### 5.5 `src/config/env.ts`

Purpose:

- centralizes environment parsing and defaults

Top to bottom:

1. imports `dotenv` and runs `dotenv.config()`
2. defines defaults for frontend origin and RabbitMQ URL
3. defines `parseNumber()` so string env vars can be safely converted to numbers
4. exports one immutable `config` object
5. `config.port` controls the service port
6. `config.frontendOrigin` controls CORS
7. `config.publicWebsocketUrl` is the URL placed in `SessionReadyPayload`
8. `config.gracePeriodMs` is how long a disconnected participant can reconnect
9. `config.joinTokenTtlMs` is how long a join token remains valid
10. `config.supabase` is used for auth verification
11. `config.rabbitmq` stores the exchange, queue, and routing key names
12. `config.redis` stores the connection settings for Redis
13. `config.logLevel` controls logger verbosity

If a value is used across multiple files, it should come from `config`, not from direct `process.env` access.

### 5.6 `src/config/rabbitmq.ts`

Purpose:

- provides one reusable RabbitMQ connection and channel

Top to bottom:

1. imports `amqplib`
2. imports `config`
3. imports the logger
4. defines module-level `connection` and `channel` caches
5. exports `connectRabbitMq()`
6. `connectRabbitMq()`:
   - returns the cached connection/channel if already connected
   - otherwise opens a new AMQP connection
   - creates a channel
   - logs success
   - returns both objects

Why it matters:

- consumers should not open a new RabbitMQ connection every time they need to work

### 5.7 `src/config/redis.ts`

Purpose:

- creates the shared Redis client for the persistence layer

Top to bottom:

1. imports `createClient`
2. imports `config`
3. imports the logger
4. creates the Redis client using `config.redis`
5. adds a `connect` event log
6. adds an `error` event log
7. exports `connectRedis()`
8. `connectRedis()` checks `redis.isOpen` to avoid duplicate connections
9. returns the Redis client

Why it matters:

- all persistence functions in `sessionPersistence.ts` depend on this one client

### 5.8 `src/lib/supabase.ts`

Purpose:

- verifies that a browser socket really belongs to an authenticated Supabase user

Top to bottom:

1. imports `config`
2. defines `SupabaseUserResponse`
3. exports `getSupabaseUser(accessToken)`
4. the function first checks that `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` exist
5. it calls `GET /auth/v1/user` on Supabase
6. it passes:
   - `Authorization: Bearer <access token>`
   - `apikey: <service key>`
7. if Supabase rejects the token, return `null`
8. if it accepts the token, return the parsed user payload

Why it matters:

- notification sockets and session sockets do not trust `userId` claimed by the client
- they verify the actual user identity first

### 5.9 `src/types/contracts.ts`

Purpose:

- defines the shared payload shapes used inside the collaboration service

Read top to bottom:

1. `Difficulty`
2. `Question`
3. `MatchFoundEvent`
4. `JoinTokenClaims`
5. `SessionReadyPayload`
7. notification socket events
8. `SessionJoinedPayload`
9. document sync payloads
10. participant status payload
11. session-ended payload
12. session namespace event interfaces

Important contracts:

- `MatchFoundEvent` is what matching publishes to RabbitMQ
- `SessionReadyPayload` is what the user receives before joining the session room
- `doc:sync` is the full Yjs state for a joining client
- `doc:update` is an incremental Yjs update
- `participant:status` is how peer presence changes are announced
- `session:ended` tells the frontend the room is over

### 5.10 `src/types/session.ts`

Purpose:

- defines the collaboration domain models stored by the service

Read top to bottom:

1. participant status enum type
2. session status enum type
3. `SessionParticipant`
4. `CollaborationSession`
5. `StoredJoinToken`
6. `SessionDocumentSnapshot`
7. `PendingDeliveryRecord`
8. `GracePeriodRecord`
9. `PersistedSessionSeed`

These types represent Redis-backed records, not just socket messages.

### 5.11 `src/types/amqplib.d.ts`

Purpose:

- TypeScript module declaration support for `amqplib`

This file exists so the TypeScript compiler accepts the RabbitMQ import cleanly.

### 5.12 `src/utils/logger.ts`

Purpose:

- very small local logger with level filtering

Top to bottom:

1. defines `LogLevel`
2. defines `Logger`
3. constructor reads `LOG_LEVEL`
4. `shouldLog()` decides whether a message is above the current level
5. `write()` formats timestamp + level + message
6. `debug`, `info`, `warn`, `error` are small wrappers
7. exports one `logger` instance

### 5.13 `src/services/sessionPersistence.ts`

Purpose:

- owns all Redis keys and all Redis reads/writes

This is one of the most important files in the service.

Read it top to bottom:

1. imports crypto, config, redis, and the domain types
2. defines `MATCH_LOCK_TTL_SECONDS`
3. `sessionTtlSeconds()` calculates how long session records should live
4. `deliveryTtlSeconds()` calculates the pending notification TTL
5. `graceTtlSeconds()` calculates the grace-period TTL
6. `parseJson()` is a small helper for Redis string values
7. `collabKeys` defines the canonical Redis key layout

Redis keys:

- `collab:match:{matchId}:session`
- `collab:lock:match:{matchId}`
- `collab:session:{sessionId}`
- `collab:session:{sessionId}:participants`
- `collab:session:{sessionId}:question`
- `collab:session:{sessionId}:doc`
- `collab:session:{sessionId}:token:{userId}`
- `collab:session:{sessionId}:grace:{userId}`
- `collab:user:{userId}:delivery:{sessionId}`
- `collab:user:{userId}:deliveries`

Function walkthrough:

1. `hashJoinToken()` hashes the raw token before verification storage
2. `claimMatchSessionLock()` uses Redis `SET NX EX` to acquire the idempotency lock
3. `releaseMatchSessionLock()` removes that lock
4. `getSessionIdByMatchId()` reads the match-to-session mapping
5. `persistSessionSeed()` writes the very first session state in one Redis transaction
6. `getSession()` reads the session metadata
7. `saveSession()` overwrites the session metadata
8. `updateSessionStatus()` reads, mutates, and saves the session status
9. `getQuestionSnapshot()` reads the persisted question payload
10. `getParticipants()` reads the participant list
11. `saveParticipants()` overwrites the whole participant list
12. `updateParticipantPresence()` updates one participant by rewriting the array
13. `getStoredJoinToken()` reads one user's stored join token record
14. `saveDocumentSnapshot()` writes the latest persisted document snapshot
15. `getDocumentSnapshot()` reads it
16. `savePendingDelivery()` stores `session-ready` for offline replay and indexes it by user
17. `getPendingDelivery()` reads one pending record
18. `clearPendingDelivery()` deletes one pending record and removes it from the user's index
19. `listPendingDeliveries()` loads all indexed records and lazily cleans broken index entries
20. `saveGracePeriod()` writes a reconnect grace record
21. `getGracePeriod()` reads a reconnect grace record
22. `clearGracePeriod()` deletes it
23. `deleteSessionState()` deletes all Redis state associated with a finished session

If someone changes key names or record shapes, this is the file they must understand first.

### 5.14 `src/services/sessionStore.ts`

Purpose:

- constructs the initial session seed from a `MatchFoundEvent`

Top to bottom:

1. imports crypto helpers, config, contracts, types, and persistence helpers
2. `JoinTokenRecord` is a temporary helper shape
3. the session seed no longer derives starter code from the question payload
4. `createJoinToken()` creates the raw random token and its claims
5. `buildSessionSeed()` constructs:
   - session metadata
   - two disconnected participants
   - question payload
   - empty initial document
   - two join-token records
6. `createSessionFromMatchFound()` is the public orchestration function
7. it first checks the fast idempotent path
8. then acquires the Redis match lock
9. then rechecks under the lock
10. then persists the seed
11. finally releases the lock in `finally`

This file is the only place that creates new collaboration sessions.

### 5.15 `src/services/notificationService.ts`

Purpose:

- builds and delivers `session-ready` payloads

Top to bottom:

1. imports config, persistence helpers, the contract type, the transport interface, and logger
2. `buildDeliveryExpiry()` computes how long a pending notification should survive
3. `createSessionReadyPayload()` loads:
   - session metadata
   - question snapshot
   - stored join token
4. if any of those are missing, return `null`
5. otherwise build the user-specific `SessionReadyPayload`
6. `queueSessionReadyNotification()` persists the payload so offline users can still receive it later
7. `deliverPendingNotifications()` asks the transport to emit every pending payload for one user, then clears them
8. `deliverSessionReadyIfConnected()` checks if the transport says the user is online, then emits immediately if a pending record exists

Important design point:

- this file no longer depends on raw Socket.IO
- it depends on `NotificationTransport`

That is the gateway-friendly boundary introduced later in the service.

### 5.16 `src/services/notificationSocket.ts`

Purpose:

- owns the pre-session authenticated notification socket

Top to bottom:

1. imports socket event types
2. imports `getSupabaseUser()`
3. imports `deliverPendingNotifications()`
4. imports `NotificationTransport`
5. defines `NotificationServer` as the typed Socket.IO server
6. `getBearerToken()` reads the frontend access token from either:
   - `socket.handshake.auth.token`
   - `Authorization` header
7. `configureNotificationNamespace()` sets up the namespace
8. middleware authenticates the browser token with Supabase
9. on connection, store the authenticated `userId` on `socket.data`
10. on `notification:register`, enforce that the payload `userId` matches the authenticated user
11. register the socket with the notification transport
12. replay pending notifications
13. log disconnects

This is the edge point for queue-stage realtime delivery.

### 5.17 `src/services/realtimeTransport.ts`

Purpose:

- defines the boundary between collaboration domain logic and the concrete socket implementation

This file was added so a future API gateway can proxy or replace the Socket.IO edge without forcing a rewrite of the collaboration domain logic.

Top to bottom:

1. imports `Namespace`, `Server`, contract payloads, and the logger
2. defines room prefixes for user-level and session-level delivery
3. defines `NotificationTransport`
4. defines `SessionTransport`
5. defines local types for the notification server and session namespace
6. `getUserRoom()` maps one user to one room name
7. `getSessionRoom()` maps one session to one room name
8. `createSocketIoNotificationTransport()` adapts raw Socket.IO to `NotificationTransport`
9. `createSocketIoSessionTransport()` adapts the `/session` namespace to `SessionTransport`

In practice this means:

- domain code emits transport-neutral payloads
- this file decides how those payloads move over Socket.IO today
- later, the gateway team can replace the adapter without changing the payloads or the lifecycle logic

### 5.18 `src/services/matchFoundConsumer.ts`

Purpose:

- consumes the RabbitMQ `MatchFound` event and turns it into a ready collaboration session

Top to bottom:

1. imports config, the event type, session creation, notification helpers, transport interface, and logger
2. `parseMatchFoundEvent()` parses and minimally validates the RabbitMQ payload
3. `startMatchFoundConsumer()`:
   - asserts the exchange
   - asserts the queue
   - binds the queue to the routing key
   - sets `prefetch(1)`
   - starts consuming messages
4. for each message:
   - parse the event
   - create the session idempotently
   - build two `SessionReadyPayload`s
   - if the session was newly created, queue them in Redis
   - try immediate live delivery through the notification transport
   - log success
   - `ack` the message
5. on failure:
   - log the error
   - `nack` without requeue

Important note:

- this consumer now depends on `NotificationTransport`, not raw Socket.IO

### 5.19 `src/services/documentSyncService.ts`

Purpose:

- owns the in-memory Yjs document lifecycle for active sessions

Top to bottom:

1. imports `Buffer`, `Y`, persistence helpers, and the document snapshot type
2. defines constants:
   - `DOCUMENT_TEXT_KEY`
   - `SNAPSHOT_PERSIST_DEBOUNCE_MS`
3. defines `ActiveDocument`
4. defines `activeDocuments`, an in-memory map by `sessionId`
5. `encodeUpdateBase64()` turns binary Yjs update data into a socket-safe string
6. `decodeUpdateBase64()` does the reverse
7. `buildSnapshot()` turns a `Y.Doc` into a persisted snapshot
8. `loadDocumentFromSnapshot()` reconstructs a `Y.Doc` from Redis
9. if the snapshot is plain text, it migrates that into a Yjs `Y.Text`
10. `persistSnapshot()` writes the current doc state to Redis
11. `flushDocumentSnapshot()` forces that persist
12. `scheduleSnapshotPersist()` debounces writes
13. `getOrCreateActiveDocument()` loads from Redis once and caches the active doc in memory
14. if the doc came from plain text, it immediately rewrites it back as a Yjs snapshot
15. `getDocumentSyncPayload()` returns the full current Yjs state for a joining client
16. `applyDocumentUpdate()` applies one incremental Yjs update and schedules persistence
17. `disposeDocument()` clears timers, destroys the in-memory doc, and removes it from the map

Important note:

- Redis is the persisted state
- memory is only the active runtime cache

### 5.20 `src/services/sessionSocket.ts`

Purpose:

- owns authenticated live session joins, document updates, and session lifecycle events

This is the most complex file in the service.

Top to bottom:

1. imports namespace typing
2. imports Supabase user verification
3. imports socket event payload types
4. imports persistence helpers
5. imports document sync helpers
6. imports `SessionTransport`
7. imports logger
8. defines the typed `SessionNamespace`
9. defines an in-memory `graceTimeouts` map
10. `getGraceTimeoutKey()` creates a stable key for one participant's grace timer
11. `getBearerToken()` reads the client access token
12. `getHandshakeString()` safely reads handshake strings
13. `clearScheduledGraceTimeout()` removes a pending in-memory timer
14. `cleanupEndedSession()`:
    - marks the session ended
    - emits `session:ended`
    - disposes the active Yjs doc
    - deletes Redis session state
15. `endSessionIfComplete()` checks whether all participants are now `left`
16. `scheduleGraceExpiry()` creates the in-memory timer that will later call `handleGraceExpiry()`
17. `handleGraceExpiry()`:
    - reloads current state from Redis
    - makes sure the participant is still actually `disconnected`
    - if the grace window still has time left, reschedules
    - otherwise marks the user `left`
    - clears the grace record
    - emits `participant:status`
    - ends the session if both are gone
18. `handleParticipantLeave()`:
    - prevents double handling
    - marks the socket as explicit leave
    - clears grace state
    - marks the participant `left`
    - emits `participant:status` to the peer
    - ends the session if both are gone
    - disconnects the socket
19. `handleUnexpectedDisconnect()`:
    - ignores disconnects caused by explicit leave
    - reloads session + participant state
    - verifies the disconnect is for the current active socket
    - marks the participant `disconnected`
    - stores the grace record
    - schedules the grace expiry timer
    - emits `participant:status`
20. `configureSessionNamespace()` sets up the namespace middleware and connection handler
21. middleware:
    - reads `token`, `sessionId`, `joinToken`
    - verifies the access token with Supabase
    - loads the session, participants, and join-token record
    - rejects ended sessions
    - rejects users who are not participants
    - rejects users who already explicitly left
    - rejects expired or mismatched join tokens
    - disconnects any stale socket for the same participant
    - marks the participant `connected`
    - clears any grace record
    - stores `userId`, `sessionId`, and previous status on the socket
22. on connection:
    - joins the session room through the transport
    - marks session status `active`
    - emits `session:joined`
    - emits `doc:sync`
    - emits peer-facing `participant:status` to announce join or reconnect
23. on `doc:update`:
    - validates payload
    - applies the Yjs update
    - emits the update to the peer through the transport
24. on `session:leave`:
    - runs graceful leave logic
25. on `disconnect`:
    - runs unexpected disconnect logic

This is the file to read carefully if someone is debugging reconnect or leave behavior.

## 6. Runtime Flow In Practical Terms

### 6.1 Match Found -> Session Created

1. matching publishes `MatchFound`
2. `matchFoundConsumer.ts` receives it
3. `sessionStore.ts` creates the session seed
4. `sessionPersistence.ts` writes all first-session data into Redis
5. `notificationService.ts` creates `SessionReadyPayload`s
6. pending deliveries are stored
7. live delivery happens immediately if the user is already connected

### 6.2 Queue Notification Socket

1. frontend connects to the root notification socket
2. `notificationSocket.ts` authenticates with Supabase
3. frontend emits `notification:register`
4. transport registers the socket into `user:{id}` room
5. any pending `session-ready` payloads are replayed

### 6.3 Session Join

1. frontend gets `session-ready`
2. frontend opens `/session`
3. handshake includes:
   - Supabase access token
   - `sessionId`
   - `joinToken`
4. `sessionSocket.ts` authenticates and authorizes
5. participant becomes `connected`
6. socket receives:
   - `session:joined`
   - `doc:sync`

### 6.4 Live Editing

1. one client edits locally
2. frontend converts the edit into a Yjs update
3. frontend emits `doc:update`
4. `documentSyncService.ts` applies the update to the active `Y.Doc`
5. the service relays the update to the other participant
6. persistence is updated on a debounce

### 6.5 Disconnect / Reconnect / Leave

Unexpected disconnect:

1. socket disconnects
2. participant becomes `disconnected`
3. grace record is stored in Redis
4. in-memory timeout is started
5. peer receives `participant:status`

Reconnect in time:

1. user reconnects with the same `sessionId` and `joinToken`
2. auth passes
3. stale socket is replaced
4. grace is cleared
5. participant becomes `connected`
6. doc state is restored with `doc:sync`

Explicit leave:

1. client emits `session:leave`
2. participant becomes `left`
3. peer receives `participant:status`
4. if both are left, `session:ended` is emitted and the session is deleted

Grace expiry:

1. timer fires
2. service rechecks Redis state
3. participant becomes `left`
4. peer receives `participant:status`
5. if both are left, session cleanup runs

## 7. What The Frontend Team Must Implement

The frontend team needs to implement two socket phases.

### Queue Phase

1. after the user enters the match queue, connect to the collaboration notification socket
2. pass the Supabase access token in `socket.handshake.auth.token` or `Authorization` header
3. after socket connect, emit:

```ts
socket.emit('notification:register', { userId })
```

4. listen for:

```ts
'session-ready'
'notification:error'
```

### Session Phase

1. when `session-ready` arrives, navigate to the session page
2. open the `/session` namespace
3. pass:
   - access token
   - `sessionId`
   - `joinToken`
4. listen for:
   - `session:joined`
   - `doc:sync`
   - `doc:update`
   - `participant:status`
   - `session:ended`
   - `session:error`
5. bind Monaco to Yjs on the frontend and convert local edits into Yjs updates
6. when the user explicitly leaves, emit:

```ts
socket.emit('session:leave')
```

### Frontend Notes

- `SessionReadyPayload.websocketUrl` is the URL to connect to
- `doc:sync` is the full document snapshot
- `doc:update` is incremental
- the frontend should treat Yjs as the source of truth, not local plain text

## 8. What The Matching-Service Developer Must Do

Matching-service integration contract:

1. when a match is finalized, publish `MatchFound`
2. the event must contain:
   - `eventVersion`
   - `matchId`
   - `user1Id`
   - `user2Id`
   - `difficulty`
   - `topic`
   - `language`
   - `question`
   - `matchedAt`
3. matching must not generate `sessionId`
4. matching must not generate join tokens
5. `matchId` must be stable because collaboration uses it for idempotency

Question rules:

- use the current shared matching `Question` type exactly
- do not add images or richer snapshot fields in this flow

## 9. What The Question-Service Developer Must Do

Question-service needs to provide data in a shape that matching can embed in `MatchFound`.

Required question fields:

- `id`
- `title`
- `description`
- `difficulty`
- `topic`

Question rules:

- keep the payload aligned with the current shared matching-service `Question` type
- do not add image or starter-code fields in this version

## 10. What The API Gateway Developer Must Do

The collaboration service already has a transport boundary in `src/services/realtimeTransport.ts`.

That is the file the gateway developer should understand first.

### Gateway Design Intent

The domain logic should not care whether the client-facing realtime edge is:

- direct Socket.IO from collaboration-service
- a proxied Socket.IO gateway
- another transport adapter in the future

Current state:

- collaboration-service still hosts the actual Socket.IO server today
- the gateway can proxy this service first
- later, the gateway can replace the Socket.IO adapter layer while preserving the same payload contracts

### Gateway Responsibilities

The gateway developer should be able to:

1. proxy the notification socket
2. proxy the `/session` namespace
3. forward bearer tokens and auth headers unchanged
4. preserve Socket.IO event names and payloads exactly
5. keep `SessionReadyPayload`, `participant:status`, `doc:sync`, and `doc:update` unchanged

### Minimum Gateway Contract To Preserve

Notification phase:

- client sends auth token
- client emits `notification:register`
- gateway forwards `session-ready`

Session phase:

- client sends auth token + `sessionId` + `joinToken`
- gateway forwards:
  - `session:joined`
  - `doc:sync`
  - `doc:update`
  - `participant:status`
  - `session:ended`

### Gateway Caveats

- do not rewrite payload names
- do not rewrite join-token semantics
- do not collapse the notification phase and session phase unless the frontend is updated together
- if the gateway terminates auth, it still has to preserve the collaboration-service trust model or provide an equivalent trusted identity mechanism

## 11. What The Collaboration-Service Developer Must Do During Integration

Checklist for the developer owning this service:

1. make sure `.env` is populated correctly
2. make sure RabbitMQ exchange, queue, and routing key match matching-service
3. make sure Redis is reachable
4. make sure Supabase auth verification works
5. verify `session-ready` reaches users on the notification socket
6. verify both users can join `/session`
7. verify Yjs updates are exchanged both ways
8. verify reconnect within grace works
9. verify explicit leave works
10. verify session cleanup removes Redis state

Manual smoke-test sequence:

1. queue two users
2. publish `MatchFound`
3. inspect Redis for session creation
4. confirm `session-ready`
5. join both users to `/session`
6. edit from both sides
7. disconnect one side
8. reconnect within grace
9. leave one side
10. leave or expire the other side
11. verify session deletion

## 12. Current Limitations And Caveats

These are important for the next developer.

1. There is currently no automated test suite in this service.
2. Grace expiry scheduling is in memory, while the grace record itself is in Redis.
3. If the service restarts mid-session, active in-memory timers are lost.
4. Yjs state is persisted, but active in-memory docs are runtime-local.
5. The Dockerfile currently runs the dev server instead of the compiled production server.
6. The frontend Monaco binding is not implemented in this service because it belongs in the frontend.
7. The gateway is not implemented here; only the adapter boundary exists.

## 13. Recommended Reading Order For A New Developer

If a new developer only has one hour, read in this order:

1. `src/index.ts`
2. `src/types/contracts.ts`
3. `src/types/session.ts`
4. `src/services/sessionPersistence.ts`
5. `src/services/sessionStore.ts`
6. `src/services/matchFoundConsumer.ts`
7. `src/services/notificationService.ts`
8. `src/services/realtimeTransport.ts`
9. `src/services/documentSyncService.ts`
10. `src/services/sessionSocket.ts`

If they need to debug auth, read:

1. `src/lib/supabase.ts`
2. `src/services/notificationSocket.ts`
3. `src/services/sessionSocket.ts`

If they need to debug Redis state, read:

1. `src/services/sessionPersistence.ts`

If they need to integrate the gateway, read:

1. `src/services/realtimeTransport.ts`
2. `src/services/notificationService.ts`
3. `src/services/sessionSocket.ts`

## 14. Final Mental Model

The easiest way to remember the service is:

- `matchFoundConsumer.ts` starts the collaboration story
- `sessionStore.ts` creates the session
- `sessionPersistence.ts` stores all durable short-lived state
- `notificationService.ts` tells users a session exists
- `notificationSocket.ts` authenticates the queue-stage socket
- `sessionSocket.ts` authenticates the live room and manages lifecycle
- `documentSyncService.ts` manages the shared Yjs document
- `realtimeTransport.ts` is the seam that makes a future gateway easier

If a new developer understands those eight points, they understand the service.
