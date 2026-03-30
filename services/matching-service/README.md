# Matching Service

Real-time matching service for PeerPrep that connects users based on difficulty level and programming topics using Socket.IO, Redis, RabbitMQ, and the question service.

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

- Redis connection details
- `QUESTION_SERVICE_URL`
- `RABBITMQ_URL`
- optional log and timeout overrides

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
# Health check
curl http://localhost:3003/health

# Expected response:
# {"message":"Matching service is running"}
```

## Architecture

- **Express**: HTTP server and health endpoint
- **Socket.IO**: realtime matchmaking events
- **Redis**: queue state, timeouts, and short-lived match records
- **RabbitMQ**: publishes match handoff events for collaboration
- **Question Service**: supplies the random question for a successful match
- **TypeScript**: type-safe development

## Development

### Type Checking

```bash
npm run typecheck
```

### Build

```bash
npm run build
```

## Troubleshooting

### Port Already in Use

If you get `EADDRINUSE` error:

```bash
# Find what's using the port
lsof -i :3003

# Kill the process
kill -9 <PID>

# Or stop Docker
docker compose down
```

### Docker Container Issues

```bash
# View logs
docker logs peerprep-matching-service

# Restart container
docker compose restart matching-service

# Rebuild container
docker compose up --build
```
