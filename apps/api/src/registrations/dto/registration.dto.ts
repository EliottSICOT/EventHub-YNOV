import { ApiProperty } from '@nestjs/swagger';

export class RegistrationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({
    type: 'integer',
    example: 12,
    minimum: 0,
    description: "Places restantes de l'événement, inscription comprise",
  })
  remainingSeats: number;

  @ApiProperty({ description: 'Vrai quand il ne reste plus aucune place' })
  isFull: boolean;
}
