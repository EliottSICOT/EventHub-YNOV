import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MyRegistrationsController } from './my-registrations.controller.js';
import { RegistrationsController } from './registrations.controller.js';
import { RegistrationsService } from './registrations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RegistrationsController, MyRegistrationsController],
  providers: [RegistrationsService],
})
export class RegistrationsModule {}
