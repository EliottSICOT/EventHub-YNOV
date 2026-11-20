import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CategoriesModule } from './categories/categories.module.js';
import { EventsModule } from './events/events.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, EventsModule, CategoriesModule],
})
export class AppModule {}
