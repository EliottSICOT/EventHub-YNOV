import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertEventOrganizer } from '../events/event-ownership.js';
import { eventSummaryInclude, remainingSeats, toEventSummary } from '../events/events.mapper.js';
import { EVENT_NOT_FOUND_MESSAGE } from '../events/events.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EventRegistrantDto } from './dto/event-registrant.dto.js';
import type { RegistrationDto } from './dto/registration.dto.js';
import type { UserRegistrationDto } from './dto/user-registration.dto.js';
import type { UserWaitlistEntryDto } from './dto/user-waitlist-entry.dto.js';
import type { WaitlistEntryDto } from './dto/waitlist-entry.dto.js';
import { RegistrationMailer } from './registration-mailer.service.js';
import { type RegistrationsCsv, toRegistrationsCsv } from './registrations-csv.js';
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
        // Si l'utilisateur était encore en liste d'attente (ex. capacité augmentée), on l'en retire.
        await tx.waitlistEntry.deleteMany({ where: { eventId, userId } });
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

  /**
   * Place `userId` en liste d'attente de l'événement `eventId` (US14), uniquement s'il est
   * complet. 409 si déjà inscrit, déjà en file, événement non complet, annulé ou passé.
   */
  async joinWaitlist(
    eventId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<WaitlistEntryDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          { capacity: number; starts_at: Date; cancelled_at: Date | null }[]
        >`SELECT capacity, starts_at, cancelled_at FROM events WHERE id = ${eventId} FOR UPDATE`;
        if (locked.length === 0) {
          throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
        }
        const { capacity, starts_at: startsAt, cancelled_at: cancelledAt } = locked[0];

        const registered = await tx.registration.findUnique({
          where: { eventId_userId: { eventId, userId } },
          select: { id: true },
        });
        if (registered) {
          throw new ConflictException(REGISTRATION_MESSAGES.waitlistRegistered);
        }
        const already = await tx.waitlistEntry.findUnique({
          where: { eventId_userId: { eventId, userId } },
          select: { id: true },
        });
        if (already) {
          throw new ConflictException(REGISTRATION_MESSAGES.alreadyOnWaitlist);
        }
        if (cancelledAt) {
          throw new ConflictException(REGISTRATION_MESSAGES.eventCancelled);
        }
        if (startsAt <= now) {
          throw new ConflictException(REGISTRATION_MESSAGES.eventPast);
        }
        const taken = await tx.registration.count({ where: { eventId } });
        if (taken < capacity) {
          throw new ConflictException(REGISTRATION_MESSAGES.waitlistNotFull);
        }

        const ahead = await tx.waitlistEntry.count({ where: { eventId } });
        const entry = await tx.waitlistEntry.create({ data: { eventId, userId } });
        return {
          id: entry.id,
          eventId,
          createdAt: entry.createdAt.toISOString(),
          position: ahead + 1,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(REGISTRATION_MESSAGES.alreadyOnWaitlist);
      }
      throw error;
    }
  }

  /** Listes d'attente de `userId`, de l'événement le plus proche au plus lointain (US14). */
  async listWaitlistForUser(userId: string): Promise<UserWaitlistEntryDto[]> {
    const entries = await this.prisma.waitlistEntry.findMany({
      where: { userId },
      include: { event: { include: eventSummaryInclude } },
      orderBy: [{ event: { startsAt: 'asc' } }, { id: 'asc' }],
    });
    if (entries.length === 0) return [];

    const eventIds = [...new Set(entries.map((entry) => entry.eventId))];
    const peers = await this.prisma.waitlistEntry.findMany({
      where: { eventId: { in: eventIds } },
      select: { id: true, eventId: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const positionById = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const peer of peers) {
      const next = (counts.get(peer.eventId) ?? 0) + 1;
      counts.set(peer.eventId, next);
      positionById.set(peer.id, next);
    }

    return entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt.toISOString(),
      position: positionById.get(entry.id) ?? 1,
      event: toEventSummary(entry.event),
    }));
  }

  /**
   * Quitte la liste d'attente `entryId` (US14) : réservé au propriétaire (403 sinon).
   */
  async leaveWaitlist(entryId: string, userId: string): Promise<void> {
    const entry = await this.prisma.waitlistEntry.findUnique({
      where: { id: entryId },
      select: { userId: true },
    });
    if (!entry) {
      throw new NotFoundException(REGISTRATION_MESSAGES.waitlistNotFound);
    }
    if (entry.userId !== userId) {
      throw new ForbiddenException(REGISTRATION_MESSAGES.waitlistNotOwner);
    }

    const { count } = await this.prisma.waitlistEntry.deleteMany({
      where: { id: entryId, userId },
    });
    if (count === 0) {
      throw new NotFoundException(REGISTRATION_MESSAGES.waitlistNotFound);
    }
  }

  /**
   * Inscrits de l'événement `eventId` (US12), réservé à son organisateur `userId` :
   * 404 si l'événement n'existe pas, 403 s'il appartient à un autre organisateur.
   * Un événement annulé reste consultable.
   */
  async listForEvent(eventId: string, userId: string): Promise<EventRegistrantDto[]> {
    const registrations = await this.loadEventRegistrations(
      eventId,
      userId,
      REGISTRATION_MESSAGES.listNotOrganizer,
    );
    return registrations.map(({ createdAt, user }) => ({
      lastName: user.lastName,
      firstName: user.firstName,
      email: user.email,
      createdAt: createdAt.toISOString(),
    }));
  }

  /**
   * CSV des inscrits de l'événement `eventId` (US13), réservé à son organisateur `userId` :
   * 404 si l'événement n'existe pas, 403 s'il appartient à un autre organisateur.
   * Un événement annulé reste exportable : l'organisateur peut avoir à prévenir ses inscrits.
   */
  async exportCsv(eventId: string, userId: string): Promise<RegistrationsCsv> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, startsAt: true, organizerId: true },
    });
    assertEventOrganizer(event, userId, REGISTRATION_MESSAGES.exportNotOrganizer);
    const registrations = await this.findRegistrations(eventId);
    return toRegistrationsCsv(event, registrations);
  }

  private async loadEventRegistrations(
    eventId: string,
    userId: string,
    notOrganizerMessage: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });
    assertEventOrganizer(event, userId, notOrganizerMessage);
    return this.findRegistrations(eventId);
  }

  private findRegistrations(eventId: string) {
    return this.prisma.registration.findMany({
      where: { eventId },
      select: {
        createdAt: true,
        user: { select: { lastName: true, firstName: true, email: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
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
   * Annule l'inscription `registrationId` de `userId` (US06) : la place est libérée.
   * US14 : si quelqu'un attend, le premier de la file est inscrit automatiquement et reçoit
   * l'e-mail de confirmation (US11). 404 / 403 / 409 comme avant.
   */
  async cancel(registrationId: string, userId: string, now: Date = new Date()): Promise<void> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: {
        userId: true,
        eventId: true,
        event: { select: { startsAt: true, cancelledAt: true } },
      },
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

    const promotedId = await this.prisma.$transaction(async (tx) => {
      const eventId = registration.eventId;
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;

      // `userId` dans le filtre : même sous concurrence, on ne supprime que sa propre inscription.
      const { count } = await tx.registration.deleteMany({
        where: { id: registrationId, userId },
      });
      if (count === 0) {
        throw new NotFoundException(REGISTRATION_MESSAGES.notFound);
      }

      const next = await tx.waitlistEntry.findFirst({
        where: { eventId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, userId: true },
      });
      if (!next) return null;

      const promoted = await tx.registration.create({
        data: { eventId, userId: next.userId },
      });
      await tx.waitlistEntry.delete({ where: { id: next.id } });
      return promoted.id;
    });

    if (promotedId) {
      void this.mailer.sendConfirmation(promotedId);
    }
  }
}
