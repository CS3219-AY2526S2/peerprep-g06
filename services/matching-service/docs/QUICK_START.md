# Quick Start Checklist

Follow this checklist to get the matching service up and running on your machine.

## ✅ Setup Checklist

### Prerequisites

- [ ] Node.js installed (v18 or higher)
- [ ] npm installed
- [ ] Docker installed (if using Docker)
- [ ] Redis, Redis CLI and Redis Insight installed (for testing connection)
- [ ] Git repository cloned

### Step 1: Get Redis Credentials

- [ ] Contact a team member for Redis Cloud password
- [ ] Save credentials securely (don't share in public channels)

### Step 2: Environment Setup

- [ ] Navigate to matching service directory:
  ```bash
  cd services/matching-service
  ```

- [ ] Copy the example env file:
  ```bash
  cp .env.example .env
  ```

- [ ] Open `.env` and replace `<ask-team-for-password>` with actual password

- [ ] Copy env to project root:
  ```bash
  cp .env ../../.env
  ```

### Step 3: Install Dependencies

- [ ] Run npm install:
  ```bash
  npm install
  ```

### Step 4: Test Redis Connection

- [ ] Install redis-cli if not already installed:
  ```bash
  # macOS
  brew install redis
  
  # Ubuntu/Debian
  sudo apt-get install redis-tools
  ```

- [ ] Test connection using the script:
  ```bash
  ../../scripts/redis-connect.sh PING
  ```
  
  Expected output: `PONG`

### Step 5: Run the Service

**Choose one method:**

#### Option A: Using Docker (Recommended)

- [ ] Navigate to project root:
  ```bash
  cd ../..
  ```

- [ ] Start the service:
  ```bash
  docker compose up
  ```

- [ ] Check logs for:
  ```
  [INFO] Redis client connected
  [INFO] Matching service listening on port 3002
  ```

#### Option B: Using npm (Local Development)

- [ ] Stay in matching service directory

- [ ] Run development server:
  ```bash
  npm run dev
  ```

- [ ] Check logs for successful connection

### Step 6: Verify Everything Works

- [ ] Test health endpoint:
  ```bash
  curl http://localhost:3002/health
  ```
  
  Expected: `{"message":"Matching service is running"}`

- [ ] Check Redis connection in logs:
  ```
  [INFO] Redis client connected
  ```

- [ ] Service is running without errors

## 🎉 You're Done!

Your matching service should now be running and connected to Redis Cloud.

## ⚠️ Common Issues

### Issue: Port 3002 already in use

**Solution:**
```bash
# Stop other services using the port
docker compose down

# Or kill the process
lsof -i :3002
kill -9 <PID>
```

### Issue: Redis connection failed

**Solution:**
- Double-check your `.env` credentials
- Make sure there are no extra spaces
- Try the connection test again: `redis-cloud PING`

### Issue: npm install fails

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Docker container won't start

**Solution:**
```bash
# Rebuild containers
docker compose down
docker compose up --build
```
