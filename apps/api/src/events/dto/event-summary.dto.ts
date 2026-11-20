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
    example: 42,
    minimum: 0,
    description: 'Places encore disponibles',
  })
  remainingSeats: number;

  @ApiProperty({ description: 'Vrai si plus aucune place n’est disponible' })
  isFull: boolean;

  @ApiProperty({ type: String, nullable: true, example: null })
  imageUrl: string | null;

  @ApiProperty({ type: CategoryDto })
  category: CategoryDto;
}
