import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmailTransform } from '../email.js';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SignUpDto {
  @ApiProperty({ example: 'Léa', maxLength: 100 })
  @Transform(trim)
  @IsString({ message: 'firstName doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  @MaxLength(100, { message: 'Le prénom ne doit pas dépasser 100 caractères' })
  firstName: string;

  @ApiProperty({ example: 'Dupont', maxLength: 100 })
  @Transform(trim)
  @IsString({ message: 'lastName doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(100, { message: 'Le nom ne doit pas dépasser 100 caractères' })
  lastName: string;

  @ApiProperty({
    example: 'lea.dupont@example.com',
    format: 'email',
    description: 'Normalisé côté serveur : espaces retirés et passage en minuscules.',
  })
  @Transform(normalizeEmailTransform)
  @IsEmail({}, { message: "L'email n'est pas valide" })
  @MaxLength(254, { message: "L'email ne doit pas dépasser 254 caractères" })
  email: string;

  @ApiProperty({
    example: 'motdepasse-solide',
    format: 'password',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString({ message: 'password doit être une chaîne de caractères' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères`,
  })
  password: string;
}
