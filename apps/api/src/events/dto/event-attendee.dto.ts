import { ApiProperty } from '@nestjs/swagger';

/** Inscrit d'un événement, visible par son organisateur (US12). */
export class EventAttendeeDto {
  @ApiProperty({ example: 'Martin' })
  lastName: string;

  @ApiProperty({ example: 'Camille' })
  firstName: string;

  @ApiProperty({ example: 'camille@eventhub.test' })
  email: string;

  @ApiProperty({
    format: 'date-time',
    description: "Date d'inscription",
  })
  registeredAt: string;
}
