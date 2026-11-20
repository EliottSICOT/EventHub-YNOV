import { ApiProperty } from '@nestjs/swagger';
import { EventSummaryDto } from './event-summary.dto.js';

export class OrganizerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Camille Martin' })
  name: string;
}

export class EventDetailDto extends EventSummaryDto {
  @ApiProperty()
  description: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '3 boulevard de Stalingrad',
  })
  address: string | null;

  @ApiProperty({ type: OrganizerDto })
  organizer: OrganizerDto;
}
