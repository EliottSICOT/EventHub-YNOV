import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { RegistrationMailer } from './registration-mailer.service.js';
import { RegistrationsController } from './registrations.controller.js';
import { UserRegistrationsController } from './user-registrations.controller.js';
import { RegistrationsService } from './registrations.service.js';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [RegistrationsController, UserRegistrationsController],
  providers: [RegistrationsService, RegistrationMailer],
})
export class RegistrationsModule {}
