import type { EventDetail } from '../api/types';

/**
 * Événements créés pendant la session simulée (US08), en plus des fixtures, et modifications
 * apportées aux uns comme aux autres (US09). En mémoire ; remis à zéro entre chaque test.
 */
class MockEventStore {
  private created: EventDetail[] = [];
  private changes = new Map<string, Partial<EventDetail>>();

  reset() {
    this.created = [];
    this.changes.clear();
  }

  all(): readonly EventDetail[] {
    return this.created;
  }

  add(event: EventDetail) {
    this.created.push(event);
  }

  /** Modifie un événement, qu'il vienne des fixtures ou de la session. */
  update(event: EventDetail, changes: Partial<EventDetail>): EventDetail {
    this.changes.set(event.id, { ...this.changes.get(event.id), ...changes });
    return this.withChanges(event);
  }

  withChanges(event: EventDetail): EventDetail {
    return { ...event, ...this.changes.get(event.id) };
  }
}

export const mockEvents = new MockEventStore();
