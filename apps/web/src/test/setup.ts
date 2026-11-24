import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { mockAuth } from '../mocks/auth';
import { mockEvents } from '../mocks/events';
import { mockRegistrations } from '../mocks/registrations';
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  mockAuth.reset();
  mockRegistrations.reset();
  mockEvents.reset();
  cleanup();
});
afterAll(() => server.close());
