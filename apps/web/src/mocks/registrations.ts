/**
 * Inscriptions simulées pour les mocks MSW (US05) : couples « utilisateur, événement ».
 * Les places restantes d'un événement = celles de la fixture moins les inscriptions faites ici.
 * En mémoire ; remis à zéro entre chaque test.
 */
class MockRegistrationStore {
  private registrations = new Map<string, Set<string>>();

  reset() {
    this.registrations.clear();
  }

  has(eventId: string, userId: string) {
    return this.registrations.get(eventId)?.has(userId) ?? false;
  }

  count(eventId: string) {
    return this.registrations.get(eventId)?.size ?? 0;
  }

  add(eventId: string, userId: string) {
    const users = this.registrations.get(eventId) ?? new Set<string>();
    users.add(userId);
    this.registrations.set(eventId, users);
  }
}

export const mockRegistrations = new MockRegistrationStore();
