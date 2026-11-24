import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildConfirmationEmail } from './confirmation-email.js';

const DEFAULT_FRONT_URL = 'http://localhost:5173';

/** E-mail de confirmation d'inscription (US11). */
@Injectable()
export class RegistrationMailer {
  private readonly logger = new Logger(RegistrationMailer.name);
  private readonly frontUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.frontUrl = config.get<string>('FRONT_URL') || DEFAULT_FRONT_URL;
  }

  /**
   * Envoie la confirmation de l'inscription `registrationId`. Ne lève jamais d'erreur :
   * un échec est journalisé et l'inscription reste valide.
   * Les journaux ne contiennent pas l'adresse du participant.
   */
  async sendConfirmation(registrationId: string): Promise<void> {
    try {
      const registration = await this.prisma.registration.findUnique({
        where: { id: registrationId },
        select: {
          user: { select: { email: true, firstName: true, lastName: true } },
          event: {
            select: { title: true, startsAt: true, venue: true, address: true, city: true },
          },
        },
      });
      if (!registration) {
        this.logger.warn(`Inscription ${registrationId} annulée avant l'envoi de la confirmation`);
        return;
      }
      await this.mail.send(buildConfirmationEmail({ ...registration, frontUrl: this.frontUrl }));
      this.logger.log(`E-mail de confirmation envoyé pour l'inscription ${registrationId}`);
    } catch (error) {
      this.logger.error(
        `Échec de l'e-mail de confirmation pour l'inscription ${registrationId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
