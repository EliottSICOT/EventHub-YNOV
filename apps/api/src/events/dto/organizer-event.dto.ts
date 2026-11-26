import { ApiProperty } from '@nestjs/swagger';

/** Événement du tableau de bord organisateur (US12) : remplissage et capacité. */
export class OrganizerEventDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Nuit du jazz' })
  title: string;

  @ApiProperty({ format: 'date-time' })
  startsAt: string;

  @ApiProperty({ example: 300, minimum: 1 })
  capacity: number;

  @ApiProperty({
    example: 42,
    minimum: 0,
    description: "Nombre d'inscrits",
  })
  registeredCount: number;

  @ApiProperty({
    example: 14,
    minimum: 0,
    maximum: 100,
    description: 'Taux de remplissage en pourcentage (0–100), arrondi à l’entier le plus proche',
  })
  fillRate: number;
}
