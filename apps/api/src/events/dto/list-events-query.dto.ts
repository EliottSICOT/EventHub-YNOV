import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  type ValidationArguments,
} from 'class-validator';

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/** Vérifie que `to` n'est pas antérieur à `from`. */
function IsNotBefore(property: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isNotBefore',
      target: target.constructor,
      propertyName,
      constraints: [property],
      options: {
        message: `${propertyName} doit être postérieur ou égal à ${property}`,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[property];
          if (typeof value !== 'string' || typeof other !== 'string') return true;
          return new Date(value).getTime() >= new Date(other).getTime();
        },
      },
    });
}

export class ListEventsQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page doit être un entier' })
  @Min(1, { message: 'page doit être supérieur ou égal à 1' })
  page: number = 1;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize doit être un entier' })
  @Min(1, { message: 'pageSize doit être supérieur ou égal à 1' })
  @Max(MAX_PAGE_SIZE, {
    message: `pageSize doit être inférieur ou égal à ${MAX_PAGE_SIZE}`,
  })
  pageSize: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description:
      "Début de la période (date `YYYY-MM-DD` ou date-heure ISO 8601). Par défaut : maintenant, le catalogue n'affiche donc que les événements à venir.",
    example: '2026-12-01',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'from doit être une date ISO 8601 (YYYY-MM-DD)' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Fin de la période, incluse (une date seule couvre toute la journée, en UTC).',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'to doit être une date ISO 8601 (YYYY-MM-DD)' })
  @IsNotBefore('from')
  to?: string;

  @ApiPropertyOptional({
    description: 'Slug de la catégorie',
    example: 'concert',
  })
  @IsOptional()
  @Transform(trim)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'category doit être un slug (minuscules, chiffres, tirets)',
  })
  category?: string;

  @ApiPropertyOptional({
    description: 'Ville (recherche partielle, insensible à la casse)',
    example: 'Lyon',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'city ne doit pas dépasser 100 caractères' })
  city?: string;
}
