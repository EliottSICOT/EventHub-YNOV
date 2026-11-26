import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadStorage } from '../uploads/uploads.js';
import type { EventDetailDto } from './dto/event-detail.dto.js';
import { IMAGE_MESSAGES, type UploadedImage, validateImage } from './event-image.js';
import { assertEventOrganizer } from './event-ownership.js';
import { eventDetailInclude, toEventDetail } from './events.mapper.js';

/** Image d'un événement (US08) : réservée à son organisateur, stockée dans `UPLOADS_DIR`. */
@Injectable()
export class EventImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: UploadStorage,
  ) {}

  async setImage(
    eventId: string,
    userId: string,
    image: UploadedImage | undefined,
  ): Promise<EventDetailDto> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true, imageUrl: true },
    });
    assertEventOrganizer(event, userId, IMAGE_MESSAGES.notOrganizer);

    const extension = validateImage(image);
    const imageUrl = await this.storage.save(image!.buffer, extension);

    const updated = await this.prisma.event
      .update({ where: { id: eventId }, data: { imageUrl }, include: eventDetailInclude })
      .catch(async (error: unknown) => {
        // Pas de fichier orphelin si l'événement n'a pas pu être mis à jour.
        await this.storage.remove(imageUrl);
        throw error;
      });
    await this.storage.remove(event.imageUrl);
    return toEventDetail(updated);
  }
}
