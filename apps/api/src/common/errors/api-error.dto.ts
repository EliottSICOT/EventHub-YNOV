import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FieldErrorDto {
  @ApiProperty({
    example: 'pageSize',
    description: 'Champ en erreur (notation pointée pour les objets imbriqués)',
  })
  field: string;

  @ApiProperty({ example: 'pageSize doit être inférieur ou égal à 50' })
  message: string;
}

/**
 * Format commun de toutes les erreurs renvoyées par l'API.
 * Les formulaires du Front s'appuient sur `details` pour afficher les erreurs champ par champ.
 */
export class ApiErrorDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({
    example: 'Not Found',
    description: 'Libellé HTTP du code de statut',
  })
  error: string;

  @ApiProperty({ example: "L'événement demandé n'existe pas" })
  message: string;

  @ApiPropertyOptional({
    type: [FieldErrorDto],
    description: 'Présent uniquement pour les erreurs de validation (400)',
  })
  details?: FieldErrorDto[];

  @ApiProperty({ example: '/api/v1/events/0b6f…' })
  path: string;

  @ApiProperty({ format: 'date-time' })
  timestamp: string;
}
