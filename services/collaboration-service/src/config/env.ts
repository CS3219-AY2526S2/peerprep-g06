import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:8080';
const DEFAULT_RABBITMQ_URL = 'amqp://localhost:5672';

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
  port: parseNumber(process.env.COLLAB_SERVICE_PORT, 3004),
  frontendOrigin: process.env.COLLAB_FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGIN,
  publicWebsocketUrl:
    process.env.COLLAB_PUBLIC_WS_URL || `http://localhost:${parseNumber(process.env.COLLAB_SERVICE_PORT, 3004)}`,
  gracePeriodMs: parseNumber(process.env.COLLAB_GRACE_PERIOD_MS, 30_000),
  joinTokenTtlMs: parseNumber(process.env.COLLAB_JOIN_TOKEN_TTL_MS, 300_000),
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || DEFAULT_RABBITMQ_URL,
    matchFoundExchange: process.env.RABBITMQ_MATCH_FOUND_EXCHANGE || 'peerprep.matching',
    matchFoundQueue: process.env.RABBITMQ_MATCH_FOUND_QUEUE || 'collaboration.match-found',
    matchFoundRoutingKey: process.env.RABBITMQ_MATCH_FOUND_ROUTING_KEY || 'match.found',
  },
  redis: {
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    host: process.env.REDIS_HOST,
    port: parseNumber(process.env.REDIS_PORT, 6379),
  },
  logLevel: process.env.LOG_LEVEL || 'INFO',
} as const;
