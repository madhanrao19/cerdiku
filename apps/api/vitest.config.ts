import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// NestJS relies on `emitDecoratorMetadata` for DI. esbuild (vitest's default
// transformer) does not emit it, so we transform with SWC instead.
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts', 'src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
