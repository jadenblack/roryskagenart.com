import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  // jsdom lacks scroll-locking APIs some components touch
  window.document.body.style.overflow = '';
});

// Guard: tests must never reach the network (zero-token guarantee).
// Any accidental fetch fails loudly instead of silently hitting an API.
vi.stubGlobal(
  'fetch',
  vi.fn(() => Promise.reject(new Error('Network disabled in tests — mock your API calls')))
);

// Radix primitives assume browser APIs jsdom does not implement.
const w = window as unknown as Record<string, unknown>;

if (!w.ResizeObserver) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  w.ResizeObserver = ResizeObserverStub;
}

const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
// Radix's own jsdom test suite stubs pointer capture with REAL functions —
// jsdom's dispatchEvent only trusts events when handlers are functions.
proto.hasPointerCapture = () => false;
proto.setPointerCapture = () => {};
proto.releasePointerCapture = () => {};
