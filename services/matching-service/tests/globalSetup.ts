import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

let redisContainer: StartedRedisContainer;

export async function setup() {
  redisContainer = await new RedisContainer('redis:7-alpine').start();

  // Expose connection details as env vars for the test process
  process.env.REDIS_HOST = redisContainer.getHost();
  process.env.REDIS_PORT = String(redisContainer.getMappedPort(6379));
  process.env.REDIS_USERNAME = '';
  process.env.REDIS_PASSWORD = '';

  // Silence logs during tests
  process.env.LOG_LEVEL = 'error';
}

export async function teardown() {
  await redisContainer.stop();
}
