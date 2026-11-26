import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EVENT_NOT_FOUND_MESSAGE } from './events.constants.js';

/**
 * Contrôle du propriétaire partagé par les actions de l'organisateur (US08, US09, US13) :
 * 404 si l'événement n'existe pas, 403 s'il appartient à un autre utilisateur.
 * `forbiddenMessage` précise l'action refusée.
 */
export function assertEventOrganizer<T extends { organizerId: string }>(
  event: T | null | undefined,
  userId: string,
  forbiddenMessage: string,
): asserts event is T {
  if (!event) throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
  if (event.organizerId !== userId) throw new ForbiddenException(forbiddenMessage);
}
