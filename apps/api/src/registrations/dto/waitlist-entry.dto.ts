import { ApiProperty } from '@nestjs/swagger';

/** Entrée créée en rejoignant la liste d'attente (US14). */
export class WaitlistEntryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({
    example: 1,
    minimum: 1,
    description: 'Position dans la file (1 = prochain à être inscrit)',
  })
  position: number;
}
