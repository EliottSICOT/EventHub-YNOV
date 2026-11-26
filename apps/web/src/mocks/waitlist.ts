export interface MockWaitlistEntry {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
}

/**
 * Listes d'attente simulées pour les mocks MSW (US14).
 * En mémoire ; remises à zéro entre chaque test.
 */
class MockWaitlistStore {
  private entries: MockWaitlistEntry[] = [];

  reset() {
    this.entries = [];
  }

  has(eventId: string, userId: string) {
    return this.entries.some((e) => e.eventId === eventId && e.userId === userId);
  }

  forEvent(eventId: string) {
    return this.entries
      .filter((e) => e.eventId === eventId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  forUser(userId: string) {
    return this.entries.filter((e) => e.userId === userId);
  }

  find(id: string) {
    return this.entries.find((e) => e.id === id);
  }

  position(eventId: string, entryId: string) {
    const index = this.forEvent(eventId).findIndex((e) => e.id === entryId);
    return index >= 0 ? index + 1 : 1;
  }

  add(eventId: string, userId: string): MockWaitlistEntry {
    const entry = {
      id: crypto.randomUUID(),
      eventId,
      userId,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  remove(id: string) {
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  removeFor(eventId: string, userId: string) {
    this.entries = this.entries.filter((e) => !(e.eventId === eventId && e.userId === userId));
  }

  /** Premier de la file pour `eventId`, ou `undefined`. */
  takeFirst(eventId: string): MockWaitlistEntry | undefined {
    const [first] = this.forEvent(eventId);
    if (!first) return undefined;
    this.remove(first.id);
    return first;
  }
}

export const mockWaitlist = new MockWaitlistStore();
