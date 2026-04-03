// Centralized runtime config so the rest of the service does not read process.env directly.
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';
const DEFAULT_RABBITMQ_URL = 'amqp://localhost:5672';

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
  // Public-facing service settings used by the HTTP server and frontend bootstrap payloads.
  port: parseNumber(process.env.PORT, 3004),
  frontendOrigin: process.env.FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGIN,
  publicWebsocketUrl:
    process.env.PUBLIC_WS_URL || `http://localhost:${parseNumber(process.env.PORT, 3004)}`,
  gracePeriodMs: parseNumber(process.env.GRACE_PERIOD_MS, 30_000),
  joinTokenTtlMs: parseNumber(process.env.JOIN_TOKEN_TTL_MS, 300_000),
  // Supabase is only used here to verify that notification sockets belong to real authenticated users.
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  // RabbitMQ delivers match handoff events from matching-service into collaboration-service.
  rabbitmq: {
    url: process.env.RABBITMQ_URL || DEFAULT_RABBITMQ_URL,
    matchFoundExchange: process.env.RABBITMQ_MATCH_FOUND_EXCHANGE || 'peerprep',
    matchFoundQueue: process.env.RABBITMQ_MATCH_FOUND_QUEUE || 'collaboration.match-found',
    matchFoundRoutingKey: process.env.RABBITMQ_MATCH_FOUND_ROUTING_KEY || 'match.found',
  },
  // Redis holds the short-lived collaboration state for sessions, presence, tokens, and delivery replay.
  redis: {
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    host: process.env.REDIS_HOST,
    port: parseNumber(process.env.REDIS_PORT, 6379),
  },
  logLevel: process.env.LOG_LEVEL || 'INFO',
} as const;
