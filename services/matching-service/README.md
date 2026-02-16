# Matching Service

Real-time matching service for PeerPrep that connects users based on difficulty level and programming topics using WebSocket connections and Redis Cloud for queue management.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file and add your Redis Cloud credentials:

```bash
cp .env.example .env
```

Then edit `.env` with the actual Redis password (get from a team member).

**📚 For detailed Redis setup instructions, see: [docs/REDIS_SETUP.md](./docs/REDIS_SETUP.md)**

### 3. Run the Service

**Using Docker (Recommended):**
```bash
# From project root
docker compose up
```

**Using npm (Local Development):**
```bash
npm run dev
```

The service will be available at `http://localhost:3002`

### 4. Test the Connection

```bash
# Health check
curl http://localhost:3002/health

# Expected response:
# {"message":"Matching service is running"}
```

## Architecture

- **Express**: HTTP server for REST endpoints
- **Socket.io**: WebSocket connections for real-time matching
- **Redis Cloud**: Queue management and session storage
- **TypeScript**: Type-safe development

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Type Checking
```bash
npm run type-check
```

## Troubleshooting

### Port Already in Use

If you get `EADDRINUSE` error:

```bash
# Find what's using the port
lsof -i :3002

# Kill the process
kill -9 <PID>

# Or stop Docker
docker compose down
```

### Redis Connection Issues

See the detailed troubleshooting section in [docs/REDIS_SETUP.md](./docs/REDIS_SETUP.md#troubleshooting)

### Docker Container Issues

```bash
# View logs
docker logs peerprep-matching-service

# Restart container
docker compose restart matching-service

# Rebuild container
docker compose up --build
```