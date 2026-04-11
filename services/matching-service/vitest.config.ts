import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './tests/globalSetup.ts',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/index.ts',
        'src/config/rabbitmq/**',
        'src/config/redis.ts',
        'src/services/questionService.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@shared/types': path.resolve(__dirname, '../../shared/types.ts'),
      '@shared/constants': path.resolve(__dirname, '../../shared/constants.ts'),
    },
  },
});
