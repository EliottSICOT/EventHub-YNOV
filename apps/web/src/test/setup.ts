import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { mockAuth } from '../mocks/auth';
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  mockAuth.reset();
  cleanup();
});
afterAll(() => server.close());
