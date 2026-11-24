import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

export interface Mail {
  to: { name: string; address: string };
  subject: string;
  text: string;
  html: string;
}

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 1025;
const DEFAULT_FROM = 'EventHub <no-reply@eventhub.test>';
const TIMEOUT_MS = 5_000;

/**
 * Envoi d'e-mails par SMTP. Sans configuration, vise Mailpit (docker-compose, port 1025).
 * `SMTP_HOST` vide désactive l'envoi : le message est composé mais ne part pas (tests e2e).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly enabled: boolean;
  private readonly transport: ReturnType<typeof createTransport>;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST') ?? DEFAULT_HOST;
    this.enabled = host !== '';
    const defaults = { from: config.get<string>('MAIL_FROM') || DEFAULT_FROM };
    this.transport = this.enabled
      ? createTransport(
          {
            host,
            port: Number(config.get<string>('SMTP_PORT') || DEFAULT_PORT),
            connectionTimeout: TIMEOUT_MS,
            greetingTimeout: TIMEOUT_MS,
            socketTimeout: TIMEOUT_MS,
          },
          defaults,
        )
      : createTransport({ jsonTransport: true }, defaults);
  }

  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail(mail);
    if (!this.enabled) this.logger.debug('Envoi désactivé (SMTP_HOST vide) : e-mail non transmis');
  }
}
