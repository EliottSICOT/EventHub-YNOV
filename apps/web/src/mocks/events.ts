import type { EventDetail } from '../api/types';

/**
 * Événements créés pendant la session simulée (US08), en plus des fixtures.
 * En mémoire ; remis à zéro entre chaque test.
 */
class MockEventStore {
  private created: EventDetail[] = [];

  reset() {
    this.created = [];
  }

  all(): readonly EventDetail[] {
    return this.created;
  }

  add(event: EventDetail) {
    this.created.push(event);
  }

  update(id: string, changes: Partial<EventDetail>): EventDetail | undefined {
    const index = this.created.findIndex((e) => e.id === id);
    if (index === -1) return undefined;
    this.created[index] = { ...this.created[index], ...changes };
    return this.created[index];
  }
}

export const mockEvents = new MockEventStore();
