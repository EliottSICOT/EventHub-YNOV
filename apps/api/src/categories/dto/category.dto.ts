import { ApiProperty } from '@nestjs/swagger';

export class CategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Concert' })
  name: string;

  @ApiProperty({
    example: 'concert',
    description: 'Identifiant lisible utilisé dans les filtres',
  })
  slug: string;
}
