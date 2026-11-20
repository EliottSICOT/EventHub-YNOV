import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page: number;

  @ApiProperty({ example: 12, minimum: 1 })
  pageSize: number;

  @ApiProperty({
    example: 42,
    minimum: 0,
    description: 'Nombre total d’éléments correspondant aux filtres',
  })
  total: number;

  @ApiProperty({ example: 4, minimum: 0 })
  totalPages: number;
}
