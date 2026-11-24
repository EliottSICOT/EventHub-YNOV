import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UploadStorage } from '../uploads/uploads.js';
import { EventImagesService } from './event-images.service.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [EventsService, EventImagesService, UploadStorage],
})
export class EventsModule {}
