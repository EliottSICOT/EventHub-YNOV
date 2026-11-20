import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service.js';
import { CategoryDto } from './dto/category.dto.js';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les catégories (filtre du catalogue)' })
  @ApiOkResponse({ type: [CategoryDto] })
  listCategories(): Promise<CategoryDto[]> {
    return this.categoriesService.findAll();
  }
}
