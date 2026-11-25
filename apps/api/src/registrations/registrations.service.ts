import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eventSummaryInclude, remainingSeats, toEventSummary } from '../events/events.mapper.js';
import { EVENT_NOT_FOUND_MESSAGE } from '../events/events.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegistrationDto } from './dto/registration.dto.js';
import type { UserRegistrationDto } from './dto/user-registration.dto.js';
import { RegistrationMailer } from './registration-mailer.service.js';
import { REGISTRATION_MESSAGES } from './registrations.constants.js';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: RegistrationMailer,
  ) {}

  /**
   * Inscrit `userId` à l'événement `eventId` (US05).
   *
   * Tout se passe dans une transaction qui verrouille la ligne de l'événement
   * (`SELECT … FOR UPDATE`) : les inscriptions simultanées au même événement s'exécutent
   * l'une après l'autre, chacune comptant les places après les précédentes. La capacité
   * ne peut donc pas être dépassée. La contrainte unique `(event_id, user_id)` reste le
   * dernier filet contre un doublon.
   *
   * L'e-mail de confirmation (US11) part une fois la transaction validée, sans retarder la
   * réponse : `sendConfirmation` journalise ses échecs et ne lève jamais d'erreur.
   */
  async register(
    eventId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<RegistrationDto> {
    try {
      const confirmed = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          { capacity: number; starts_at: Date; cancelled_at: Date | null }[]
        >`SELECT capacity, starts_at, cancelled_at FROM events WHERE id = ${eventId} FOR UPDATE`;
        if (locked.length === 0) {
          throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
        }
        const { capacity, starts_at: startsAt, cancelled_at: cancelledAt } = locked[0];

        const existing = await tx.registration.findUnique({
          where: { eventId_userId: { eventId, userId } },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException(REGISTRATION_MESSAGES.alreadyRegistered);
        }
        if (cancelledAt) {
          throw new ConflictException(REGISTRATION_MESSAGES.eventCancelled);
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
      void this.mailer.sendConfirmation(confirmed.id);
      return confirmed;
    } catch (error) {
      // Filet de sécurité : la contrainte unique a été violée malgré la vérification.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(REGISTRATION_MESSAGES.alreadyRegistered);
      }
      throw error;
    }
  }

  /** Inscriptions de `userId`, de l'événement le plus proche au plus lointain (US06). */
  async listForUser(userId: string): Promise<UserRegistrationDto[]> {
    const registrations = await this.prisma.registration.findMany({
      where: { userId },
      include: { event: { include: eventSummaryInclude } },
      orderBy: [{ event: { startsAt: 'asc' } }, { id: 'asc' }],
    });
    return registrations.map((registration) => ({
      id: registration.id,
      createdAt: registration.createdAt.toISOString(),
      event: toEventSummary(registration.event),
    }));
  }

  /**
   * Annule l'inscription `registrationId` de `userId` (US06) : la place est libérée,
   * puisque les places restantes se déduisent des inscriptions.
   * 404 si elle n'existe pas, 403 si elle appartient à quelqu'un d'autre,
   * 409 si l'événement est annulé (US09) ou déjà passé.
   */
  async cancel(registrationId: string, userId: string, now: Date = new Date()): Promise<void> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: { userId: true, event: { select: { startsAt: true, cancelledAt: true } } },
    });
    if (!registration) {
      throw new NotFoundException(REGISTRATION_MESSAGES.notFound);
    }
    if (registration.userId !== userId) {
      throw new ForbiddenException(REGISTRATION_MESSAGES.notOwner);
    }
    if (registration.event.cancelledAt) {
      throw new ConflictException(REGISTRATION_MESSAGES.cancelCancelled);
    }
    if (registration.event.startsAt <= now) {
      throw new ConflictException(REGISTRATION_MESSAGES.cancelPast);
    }

    // `userId` dans le filtre : même sous concurrence, on ne supprime que sa propre inscription.
    const { count } = await this.prisma.registration.deleteMany({
      where: { id: registrationId, userId },
    });
    if (count === 0) {
      // Annulée entre-temps (double clic) : elle n'existe plus.
      throw new NotFoundException(REGISTRATION_MESSAGES.notFound);
    }
  }
}
