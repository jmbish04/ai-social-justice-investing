/**
 * Vitest configuration for the AI Social Justice Investing project.
 *
 * Ensures all tests run in a jsdom environment so both backend and frontend
 * modules share a consistent runtime during validation.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
  },
});
