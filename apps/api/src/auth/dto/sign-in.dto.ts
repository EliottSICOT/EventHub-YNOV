import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { normalizeEmail } from './sign-up.dto.js';

/**
 * Pas de règle de longueur ni de format ici : un identifiant mal formé
 * doit recevoir le même 401 générique qu'un identifiant inconnu.
 */
export class SignInDto {
  @ApiProperty({ example: 'lea.dupont@example.com', format: 'email' })
  @Transform(normalizeEmail)
  @IsString({ message: 'email doit être une chaîne de caractères' })
  @IsNotEmpty({ message: "L'email est obligatoire" })
  email: string;

  @ApiProperty({ example: 'motdepasse-solide', format: 'password' })
  @IsString({ message: 'password doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  password: string;
}
