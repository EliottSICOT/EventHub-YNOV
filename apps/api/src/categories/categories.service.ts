import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CategoryDto } from './dto/category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<CategoryDto[]> {
    return this.prisma.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }
}
