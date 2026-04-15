# Question Service

Question management service for PeerPrep.  
It provides public read endpoints for questions and protected write endpoints for admin/developer users.

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

The service will be available at `http://localhost:3002`

### 4. Test the Connection

```bash
curl http://localhost:3002/health

# Expected response:
# {"status":"ok"}
```

## API Endpoints

Base route: `/questions`

| Method | Route                                  | Auth               | Description                                          |
| ------ | -------------------------------------- | ------------------ | ---------------------------------------------------- |
| GET    | `/health`                              | None               | Health check                                         |
| GET    | `/questions`                           | None               | Get all questions                                    |
| GET    | `/questions/:id`                       | None               | Get question by ID                                   |
| GET    | `/questions/random/:difficulty/:topic` | None               | Get random question filtered by difficulty and topic |
| POST   | `/questions/add`                       | Admin or Developer | Create question                                      |
| PUT    | `/questions/:id/update`                | Admin or Developer | Update question                                      |
| DELETE | `/questions/:id/delete`                | Admin or Developer | Delete question                                      |

## Architecture

- **Express**: HTTP server and route layer
- **Supabase Auth**: token validation and role checks for write routes
- **Supabase Database**:
  - `questions` table for CRUD and random query
  - `profiles` table for role checks (`admin`, `developer`)
- **TypeScript**: typed route/controller code

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

### Random Question Returns 404

If `/questions/random/:difficulty/:topic` returns `No questions found`:

1. Verify questions exist for that difficulty
2. Verify the `topic` value exists in question `topic` arrays
3. Confirm the frontend is sending topic slugs that match DB values

### Docker Container Logs

```bash
docker logs peerprep-question-service
```
