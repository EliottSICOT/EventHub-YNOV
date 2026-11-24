import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { remainingSeats } from '../events/events.mapper.js';
import { EVENT_NOT_FOUND_MESSAGE } from '../events/events.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegistrationDto } from './dto/registration.dto.js';
import { REGISTRATION_MESSAGES } from './registrations.constants.js';

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inscrit `userId` à l'événement `eventId` (US05).
   *
   * Tout se passe dans une transaction qui verrouille la ligne de l'événement
   * (`SELECT … FOR UPDATE`) : les inscriptions simultanées au même événement s'exécutent
   * l'une après l'autre, chacune comptant les places après les précédentes. La capacité
   * ne peut donc pas être dépassée. La contrainte unique `(event_id, user_id)` reste le
   * dernier filet contre un doublon.
   */
  async register(
    eventId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<RegistrationDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ capacity: number; starts_at: Date }[]>`
          SELECT capacity, starts_at FROM events WHERE id = ${eventId} FOR UPDATE`;
        if (locked.length === 0) {
          throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
        }
        const { capacity, starts_at: startsAt } = locked[0];

        const existing = await tx.registration.findUnique({
          where: { eventId_userId: { eventId, userId } },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException(REGISTRATION_MESSAGES.alreadyRegistered);
        }
        if (startsAt <= now) {
          throw new ConflictException(REGISTRATION_MESSAGES.eventPast);
        }
        const taken = await tx.registration.count({ where: { eventId } });
        if (taken >= capacity) {
          throw new ConflictException(REGISTRATION_MESSAGES.eventFull);
        }

        const registration = await tx.registration.create({ data: { eventId, userId } });
        const remaining = remainingSeats(capacity, taken + 1);
        return {
          id: registration.id,
          eventId,
          createdAt: registration.createdAt.toISOString(),
          remainingSeats: remaining,
          isFull: remaining === 0,
        };
      });
    } catch (error) {
      // Filet de sécurité : la contrainte unique a été violée malgré la vérification.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(REGISTRATION_MESSAGES.alreadyRegistered);
      }
      throw error;
    }
  }
}
