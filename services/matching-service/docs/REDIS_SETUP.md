# Redis Cloud Connection Guide

This guide will help you connect to our Redis Cloud database for the matching service.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Connection Methods](#connection-methods)
- [Testing Your Connection](#testing-your-connection)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, make sure you have:

- Redis Installed
- Redis CLI Installed
- Redis Insight Installed (This is used to view the Redis database)

---

## Environment Setup

### 1. Create Your `.env` File

In the **matching service directory** (`services/matching-service/`), create a `.env` file:

```bash
cd services/matching-service
cp .env.example .env  # If example exists, otherwise create manually
```

### 2. Add Redis Cloud Credentials

Open `.env` and add the following variables:

```env
REDIS_USERNAME
REDIS_PASSWORD
REDIS_HOST
REDIS_PORT
MATCHING_SERVICE_PORT
```

### 3. Update Root `.env` File

Also add the same credentials to the **root project `.env`** file:

```bash
cd ../..  # Go to project root
```

Add to `.env`:
```env
REDIS_USERNAME
REDIS_PASSWORD
REDIS_HOST
REDIS_PORT
MATCHING_SERVICE_PORT
```

---

## Connection Methods

### Method 1: Using the `redis-cloud` Script (Recommended)

There is a script created for connecting to Redis Cloud.

#### Setup the Alias

Add this to your `~/.zshrc` (macOS) or `~/.bashrc` (Linux):

```bash
alias redis-cloud='~/Documents/NUS\ CS/y2s2/CS3219/peerprep-g06/scripts/redis-connect.sh'
```

Then reload your shell:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

#### Usage

**Interactive Mode:**
```bash
redis-cloud
```

This drops you into a Redis CLI session where you can run commands:
```
127.0.0.1:14059> PING
PONG
127.0.0.1:14059> KEYS *
(empty array or list of keys)
127.0.0.1:14059> exit
```

**Single Command Mode:**
```bash
redis-cloud PING
redis-cloud KEYS "*"
redis-cloud SET mykey "myvalue"
redis-cloud GET mykey
```

### Method 2: Direct Redis CLI Connection

If you prefer not to use the script:

```bash
redis-cli -h redis-14059.crce185.ap-seast-1-1.ec2.cloud.redislabs.com \
          -p 14059 \
          -a <your-password> \
          --user default \
          --no-auth-warning
```

### Method 3: Within the Application

The matching service automatically connects to Redis Cloud when you run it. The connection is configured in `src/config/redis.ts`.

**Using Docker:**
```bash
# From project root
docker compose up
```

**Using npm (Local Development):**
```bash
# From matching-service directory
cd services/matching-service
npm install
npm run dev
```

---

## Testing Your Connection

### Quick Connection Test

Run this command to test if you can connect:

```bash
redis-cloud PING
```

**Expected output:**
```
PONG
```

### Test Read/Write Operations

```bash
# Set a test key
redis-cloud SET test_key "Hello from [your-name]"

# Get the key back
redis-cloud GET test_key

# List all keys (be careful in production!)
redis-cloud KEYS "*"

# Delete the test key
redis-cloud DEL test_key
```

### Verify Application Connection

1. **Start the matching service:**
   ```bash
   # From project root
   docker compose up
   ```

2. **Check the logs for:**
   ```
   [INFO] Redis client connected
   [INFO] Matching service listening on port 3002
   ```

3. **Test the health endpoint:**
   ```bash
   curl http://localhost:3002/health
   ```

   Expected response:
   ```json
   {"message":"Matching service is running"}
   ```

---

## Troubleshooting

### Issue 1: "Connection refused" or "ECONNREFUSED"

**Possible causes:**
- Redis Cloud credentials are incorrect
- Network/firewall blocking the connection
- Redis Cloud instance is down

**Solutions:**
1. Verify your credentials in `.env`
2. Check if you can ping the Redis host:
   ```bash
   ping redis-14059.crce185.ap-seast-1-1.ec2.cloud.redislabs.com
   ```
3. Try connecting from a different network
4. Contact the team lead to verify Redis Cloud status

### Issue 2: "NOAUTH Authentication required"

**Cause:** Missing or incorrect password/username

**Solution:**
- Double-check your `REDIS_PASSWORD` and `REDIS_USERNAME` in `.env`
- Make sure there are no extra spaces or quotes

### Issue 3: Port 3002 already in use

**Error message:**
```
Error: listen EADDRINUSE: address already in use :::3002
```

**Solution:**
```bash
# Find what's using the port
lsof -i :3002

# Kill the process (replace PID with actual process ID)
kill -9 <PID>

# Or use Docker
docker compose down
```

### Issue 4: "redis-cloud: command not found"

**Solution:**
```bash
# Make sure the script is executable
chmod +x ~/Documents/NUS\ CS/y2s2/CS3219/peerprep-g06/scripts/redis-connect.sh

# Reload your shell config
source ~/.zshrc  # or ~/.bashrc
```

### Issue 5: Environment variables not loading

**In Docker:**
- Make sure `.env` file is in the project root
- Restart Docker containers: `docker compose down && docker compose up`

**In Local Development:**
- Make sure `.env` is in `services/matching-service/`
- The service loads `.env` using `dotenv` package

---

## Useful Redis Commands

Here are some common Redis commands you might need:

```bash
# Check connection
PING

# View all keys (use carefully, can be slow with many keys)
KEYS *

# Get a specific key
GET key_name

# Set a key with value
SET key_name "value"

# Delete a key
DEL key_name

# Check if key exists
EXISTS key_name

# Set key with expiration (in seconds)
SETEX key_name 3600 "value"

# Get remaining time to live
TTL key_name

# View server info
INFO

# Clear all keys (DANGEROUS - use only in development!)
FLUSHALL
```

---

## Additional Resources

- [Redis Commands Documentation](https://redis.io/commands/)
- [Redis Cloud Documentation](https://redis.io/docs/stack/get-started/cloud/)
