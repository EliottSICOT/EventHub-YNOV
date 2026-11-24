import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  type ValidationArguments,
} from 'class-validator';

export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 5000;
export const PLACE_MAX_LENGTH = 120;
export const ADDRESS_MAX_LENGTH = 200;
export const CITY_MAX_LENGTH = 100;
/** Bornes hautes : protègent la colonne `Int` de PostgreSQL contre un dépassement. */
export const CAPACITY_MAX = 100_000;
export const PRICE_CENTS_MAX = 1_000_000;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Champ facultatif : une chaîne vide (ou d'espaces) équivaut à une absence de valeur. */
const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/** La date doit être postérieure à l'instant de la validation. */
function IsFutureDate(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isFutureDate',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true;
          return new Date(value).getTime() > Date.now();
        },
      },
    });
}

/** La date doit être strictement postérieure à celle de `property`, si les deux sont renseignées. */
function IsAfter(property: string, message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isAfter',
      target: target.constructor,
      propertyName,
      constraints: [property],
      options: { message },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[property];
          if (typeof value !== 'string' || typeof other !== 'string') return true;
          return new Date(value).getTime() > new Date(other).getTime();
        },
      },
    });
}

/**
 * Corps de `POST /events` (US08). L'organisateur est l'utilisateur connecté : il ne figure
 * jamais dans le corps (un champ inconnu est refusé). L'image s'envoie à part, sur
 * `POST /events/{id}/image`.
 *
 * Réutilisable pour la modification (US09) : `class UpdateEventDto extends PartialType(CreateEventDto) {}`.
 */
export class CreateEventDto {
  @ApiProperty({
    example: 'Nuit du jazz',
    minLength: TITLE_MIN_LENGTH,
    maxLength: TITLE_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString({ message: 'Le titre doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le titre est obligatoire' })
  @MinLength(TITLE_MIN_LENGTH, {
    message: `Le titre doit contenir au moins ${TITLE_MIN_LENGTH} caractères`,
  })
  @MaxLength(TITLE_MAX_LENGTH, {
    message: `Le titre ne doit pas dépasser ${TITLE_MAX_LENGTH} caractères`,
  })
  title: string;

  @ApiProperty({
    example: 'Trois quartets lyonnais se succèdent sur la scène du Transbordeur.',
    maxLength: DESCRIPTION_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La description est obligatoire' })
  @MaxLength(DESCRIPTION_MAX_LENGTH, {
    message: `La description ne doit pas dépasser ${DESCRIPTION_MAX_LENGTH} caractères`,
  })
  description: string;

  @ApiProperty({
    description: 'Identifiant d’une catégorie existante (`GET /categories`)',
    example: '5d1f0c52-6a3e-4b8e-9a43-0d7f1e2b9c22',
  })
  @IsString({ message: 'La catégorie est obligatoire' })
  @IsNotEmpty({ message: 'La catégorie est obligatoire' })
  categoryId: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Début de l’événement, dans le futur (date-heure ISO 8601).',
    example: '2026-12-05T18:00:00.000Z',
  })
  @IsNotEmpty({ message: 'La date de début est obligatoire' })
  @IsISO8601(
    { strict: true },
    { message: 'La date de début doit être une date-heure ISO 8601 valide' },
  )
  @IsFutureDate('La date de début doit être dans le futur')
  startsAt: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Fin de l’événement, facultative, postérieure au début.',
    example: '2026-12-05T21:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'La date de fin doit être une date-heure ISO 8601 valide' },
  )
  @IsAfter('startsAt', 'La date de fin doit être postérieure à la date de début')
  endsAt?: string;

  @ApiProperty({ example: 'Le Transbordeur', maxLength: PLACE_MAX_LENGTH })
  @Transform(trim)
  @IsString({ message: 'Le lieu doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le lieu est obligatoire' })
  @MaxLength(PLACE_MAX_LENGTH, {
    message: `Le lieu ne doit pas dépasser ${PLACE_MAX_LENGTH} caractères`,
  })
  venue: string;

  @ApiPropertyOptional({ example: '3 boulevard de Stalingrad', maxLength: ADDRESS_MAX_LENGTH })
  @IsOptional()
  @Transform(trimOptional)
  @IsString({ message: "L'adresse doit être une chaîne de caractères" })
  @MaxLength(ADDRESS_MAX_LENGTH, {
    message: `L'adresse ne doit pas dépasser ${ADDRESS_MAX_LENGTH} caractères`,
  })
  address?: string;

  @ApiProperty({ example: 'Lyon', maxLength: CITY_MAX_LENGTH })
  @Transform(trim)
  @IsString({ message: 'La ville doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La ville est obligatoire' })
  @MaxLength(CITY_MAX_LENGTH, {
    message: `La ville ne doit pas dépasser ${CITY_MAX_LENGTH} caractères`,
  })
  city: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: CAPACITY_MAX, example: 300 })
  @IsInt({ message: 'La capacité doit être un nombre entier' })
  @Min(1, { message: "La capacité doit être d'au moins 1 place" })
  @Max(CAPACITY_MAX, { message: 'La capacité ne doit pas dépasser 100 000 places' })
  capacity: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: PRICE_CENTS_MAX,
    description: "Prix en centimes d'euro, 0 pour un événement gratuit",
    example: 1500,
  })
  @IsInt({ message: 'Le prix doit être un nombre entier de centimes' })
  @Min(0, { message: 'Le prix doit être positif ou nul' })
  @Max(PRICE_CENTS_MAX, { message: 'Le prix ne doit pas dépasser 10 000 €' })
  priceCents: number;
}
