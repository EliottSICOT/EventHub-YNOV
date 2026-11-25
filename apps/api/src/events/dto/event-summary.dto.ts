import { ApiProperty } from '@nestjs/swagger';
import { CategoryDto } from '../../categories/dto/category.dto.js';

export class EventSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Nuit du jazz' })
  title: string;

  @ApiProperty({ format: 'date-time' })
  startsAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endsAt: string | null;

  @ApiProperty({ example: 'Le Transbordeur', description: 'Nom du lieu' })
  venue: string;

  @ApiProperty({ example: 'Lyon' })
  city: string;

  @ApiProperty({ example: 300, minimum: 1 })
  capacity: number;

  @ApiProperty({
    type: 'integer',
    example: 1500,
    minimum: 0,
    description: 'Prix en centimes d’euro (0 = gratuit)',
  })
  priceCents: number;

  @ApiProperty({
    example: 42,
    minimum: 0,
    description: 'Places encore disponibles',
  })
  remainingSeats: number;

  @ApiProperty({ description: 'Vrai si plus aucune place n’est disponible' })
  isFull: boolean;

  @ApiProperty({
    example: false,
    description:
      "Vrai si l'organisateur a supprimé l'événement : absent du catalogue, inscriptions fermées",
  })
  isCancelled: boolean;

  @ApiProperty({ type: String, nullable: true, example: null })
  imageUrl: string | null;

  @ApiProperty({ type: CategoryDto })
  category: CategoryDto;
}
