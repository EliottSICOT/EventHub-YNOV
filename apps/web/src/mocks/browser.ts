import { setupWorker } from 'msw/browser';
import { mockAuth } from './auth';
import { handlers } from './handlers';

// Comme le cookie de l'API, la session simulée survit au rechargement de la page (onglet courant).
mockAuth.persistTo(sessionStorage);

export const worker = setupWorker(...handlers);
