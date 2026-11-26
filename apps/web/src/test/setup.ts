import { File as NodeFile } from 'node:buffer';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { mockAuth } from '../mocks/auth';
import { mockEvents } from '../mocks/events';
import { mockRegistrations } from '../mocks/registrations';
import { mockWaitlist } from '../mocks/waitlist';
import { server } from '../mocks/server';

/**
 * jsdom remplace FormData et File par les siens, que le `fetch` de Node ne sait ni envoyer
 * (le fichier part sous la forme « [object File] ») ni relire. On rétablit ceux de Node,
 * comme dans un navigateur où FormData, File et fetch vont ensemble.
 */
const { constructor: NodeFormData } = await new Response(new URLSearchParams()).formData();
globalThis.FormData = NodeFormData as typeof FormData;
globalThis.File = NodeFile as unknown as typeof File;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  mockAuth.reset();
  mockRegistrations.reset();
  mockWaitlist.reset();
  mockEvents.reset();
  cleanup();
});
afterAll(() => server.close());
