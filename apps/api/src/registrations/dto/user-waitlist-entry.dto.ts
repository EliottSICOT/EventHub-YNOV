import { ApiProperty } from '@nestjs/swagger';
import { EventSummaryDto } from '../../events/dto/event-summary.dto.js';

/** Une place en liste d'attente de l'utilisateur connecté (US14). */
export class UserWaitlistEntryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({
    example: 1,
    minimum: 1,
    description: 'Position dans la file (1 = prochain à être inscrit)',
  })
  position: number;

  @ApiProperty({ type: EventSummaryDto })
  event: EventSummaryDto;
}
