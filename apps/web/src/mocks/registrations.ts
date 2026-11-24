export interface MockRegistration {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
}

/**
 * Inscriptions simulées pour les mocks MSW (US05, US06).
 * Les places restantes d'un événement = celles de la fixture moins les inscriptions faites ici.
 * En mémoire ; remis à zéro entre chaque test.
 */
class MockRegistrationStore {
  private registrations: MockRegistration[] = [];

  reset() {
    this.registrations = [];
  }

  has(eventId: string, userId: string) {
    return this.registrations.some((r) => r.eventId === eventId && r.userId === userId);
  }

  count(eventId: string) {
    return this.registrations.filter((r) => r.eventId === eventId).length;
  }

  find(id: string) {
    return this.registrations.find((r) => r.id === id);
  }

  forUser(userId: string) {
    return this.registrations.filter((r) => r.userId === userId);
  }

  add(eventId: string, userId: string): MockRegistration {
    const registration = {
      id: crypto.randomUUID(),
      eventId,
      userId,
      createdAt: new Date().toISOString(),
    };
    this.registrations.push(registration);
    return registration;
  }

  remove(id: string) {
    this.registrations = this.registrations.filter((r) => r.id !== id);
  }
}

export const mockRegistrations = new MockRegistrationStore();
