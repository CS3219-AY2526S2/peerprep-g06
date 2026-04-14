# User Service

User/profile service for PeerPrep.  
It exposes profile lookups and the admin/demote request workflow backed by Supabase.

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
- optional `PORT` and `NODE_ENV`

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

The service will be available at `http://localhost:3001`

### 4. Test the Connection

```bash
curl http://localhost:3001/health

# Expected response:
# {"status":"User service is running"}
```

## API Endpoints

Base route: `/users`

| Method | Route                                | Auth                                         | Description                     |
| ------ | ------------------------------------ | -------------------------------------------- | ------------------------------- |
| GET    | `/health`                            | None                                         | Health check                    |
| GET    | `/users/profile`                     | None on route (handler expects user context) | Get current user profile        |
| GET    | `/users/profile/:userId`             | None                                         | Get display name by user ID     |
| POST   | `/users/:id/admin-request`           | None                                         | Submit promotion request        |
| GET    | `/users/admin-requests`              | Developer                                    | List pending promotion requests |
| PATCH  | `/users/admin-requests/:id/approve`  | Developer                                    | Approve promotion request       |
| PATCH  | `/users/admin-requests/:id/reject`   | Developer                                    | Reject promotion request        |
| POST   | `/users/:id/demote-request`          | Admin                                        | Submit demotion request         |
| GET    | `/users/demote-requests`             | Developer                                    | List pending demotion requests  |
| PATCH  | `/users/demote-requests/:id/approve` | Developer                                    | Approve demotion request        |
| PATCH  | `/users/demote-requests/:id/reject`  | Developer                                    | Reject demotion request         |

## Architecture

- **Express**: HTTP server and route wiring
- **Supabase Auth**: Bearer-token validation in middleware for protected routes
- **Supabase Database**:
  - `profiles` for user profile/role fields
  - `admin_requests` for promote/demote request lifecycle
- **TypeScript**: typed controller/service layer

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

### Port Already in Use

```bash
# Stop compose stack from project root
docker compose down
```

### Supabase Credential Errors

If you get missing credential errors at startup:

1. Confirm `.env` exists in `services/user-service/`
2. Confirm both `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set
3. Restart the service after updating env values

### Docker Container Logs

```bash
docker logs peerprep-user-service
```
