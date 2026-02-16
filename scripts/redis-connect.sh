#!/bin/bash

# Load environment variables from .env file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Source the .env file
set -a
source "$ENV_FILE"
set +a

# Use REDISCLI_AUTH environment variable (safer - no command-line password exposure)
export REDISCLI_AUTH="$REDIS_PASSWORD"

# Connect to Redis Cloud using environment variables (--no-auth-warning suppresses security warning)
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --user "$REDIS_USERNAME" --no-auth-warning "$@"
