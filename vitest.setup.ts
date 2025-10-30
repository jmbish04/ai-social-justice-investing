/**
 * Global Vitest setup for React + Cloudflare Worker tests.
 *
 * Registers Testing Library matchers and stubs HTMLMediaElement playback
 * APIs so audio interactions can be exercised without a real browser engine.
 */
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: vi.fn(),
});
