import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Vitest 5 assigns environments per project (environmentMatchGlobs no longer exists).
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
            environment: 'node',
            include: ['tests/unit/**/*.test.ts'],
            exclude: ['tests/unit/app/**'],
          },
        },
        {
          extends: true,
          test: {
            name: 'app',
            environment: 'jsdom',
            include: ['tests/unit/app/**/*.test.{ts,tsx}'],
            setupFiles: ['tests/unit/app/setup.ts'],
          },
        },
      ],
    },
  }),
);
