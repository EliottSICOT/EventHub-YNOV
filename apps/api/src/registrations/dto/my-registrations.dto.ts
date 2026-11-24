import { ApiProperty } from '@nestjs/swagger';
import { EventSummaryDto } from '../../events/dto/event-summary.dto.js';

export class MyRegistrationDto {
  @ApiProperty({ format: 'uuid', description: "Identifiant de l'inscription" })
  id: string;

  @ApiProperty({ format: 'date-time', description: "Date de l'inscription" })
  createdAt: string;

  @ApiProperty({ type: EventSummaryDto })
  event: EventSummaryDto;
}

export class MyRegistrationsDto {
  @ApiProperty({
    type: [MyRegistrationDto],
    description: "Événements qui n'ont pas commencé, du plus proche au plus lointain",
  })
  upcoming: MyRegistrationDto[];

  @ApiProperty({
    type: [MyRegistrationDto],
    description: 'Événements commencés ou terminés, du plus récent au plus ancien',
  })
  past: MyRegistrationDto[];
}
