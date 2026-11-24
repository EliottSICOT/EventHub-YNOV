import { ApiProperty } from '@nestjs/swagger';
import { EventSummaryDto } from '../../events/dto/event-summary.dto.js';

/** Une inscription de l'utilisateur connecté, avec l'événement concerné. */
export class UserRegistrationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({
    type: EventSummaryDto,
    description: "Événement, avec ses places restantes à jour (l'annulation en libère une)",
  })
  event: EventSummaryDto;
}
