import { ApiProperty } from '@nestjs/swagger';

/** Un inscrit d'un événement, pour le tableau de bord organisateur (US12). */
export class EventRegistrantDto {
  @ApiProperty({ example: 'Dupont' })
  lastName: string;

  @ApiProperty({ example: 'Léa' })
  firstName: string;

  @ApiProperty({ example: 'lea.dupont@example.com' })
  email: string;

  @ApiProperty({
    format: 'date-time',
    description: "Date d'inscription",
  })
  createdAt: string;
}
