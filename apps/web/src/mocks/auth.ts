import type { User } from '../api/types';

/** Mot de passe de tous les comptes de démo, comme dans le seed de l'API. */
export const DEMO_PASSWORD = 'eventhub-demo';

export const demoUsers: User[] = [
  {
    id: '0d6a1b52-1b0e-4b8e-9a43-0d7f1e2b9c01',
    email: 'participant1@eventhub.test',
    firstName: 'Participant',
    lastName: '1',
    role: 'PARTICIPANT',
  },
  {
    id: '0d6a1b52-1b0e-4b8e-9a43-0d7f1e2b9c02',
    email: 'camille@eventhub.test',
    firstName: 'Camille',
    lastName: 'Martin',
    role: 'ORGANIZER',
  },
];

interface Account {
  user: User;
  password: string;
}

/**
 * Comptes et session simulés en mémoire pour les mocks MSW.
 * Une seule session à la fois, comme un navigateur avec son cookie `eventhub_session`.
 * En `dev:mock`, la session est perdue au rechargement de la page.
 */
class MockAuthStore {
  private accounts = new Map<string, Account>();
  private sessionUserId: string | null = null;

  constructor() {
    this.reset();
  }

  /** Revient aux comptes de démo, sans session. Appelé entre chaque test. */
  reset() {
    this.accounts = new Map(
      demoUsers.map((user) => [user.email, { user: { ...user }, password: DEMO_PASSWORD }]),
    );
    this.sessionUserId = null;
  }

  findByEmail(email: string): Account | undefined {
    return this.accounts.get(email.trim().toLowerCase());
  }

  create(input: { firstName: string; lastName: string; email: string; password: string }): User {
    const user: User = {
      id: crypto.randomUUID(),
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: 'PARTICIPANT',
    };
    this.accounts.set(user.email, { user, password: input.password });
    return user;
  }

  /** Ouvre une session pour `email`, comme si le cookie avait été posé. */
  signIn(email: string) {
    this.sessionUserId = this.findByEmail(email)?.user.id ?? null;
  }

  signOut() {
    this.sessionUserId = null;
  }

  get currentUser(): User | null {
    if (!this.sessionUserId) return null;
    for (const { user } of this.accounts.values()) {
      if (user.id === this.sessionUserId) return user;
    }
    return null;
  }
}

export const mockAuth = new MockAuthStore();
