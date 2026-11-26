import { ApiProperty } from '@nestjs/swagger';

/** Résumé d'un événement pour le tableau de bord organisateur (US12). */
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
    description: 'Taux de remplissage en pourcentage entier (inscrits / capacité)',
  })
  fillRate: number;

  @ApiProperty({
    example: false,
    description: "Vrai si l'organisateur a supprimé l'événement",
  })
  isCancelled: boolean;
}
