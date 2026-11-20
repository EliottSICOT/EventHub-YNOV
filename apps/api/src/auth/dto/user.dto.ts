import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';

/** Utilisateur exposé par l'API : jamais de mot de passe ni de hash. */
export class UserDto {
  @ApiProperty({ format: 'uuid', example: '3f0c1a52-6a3e-4b8e-9a43-0d7f1e2b9c11' })
  id: string;

  @ApiProperty({ format: 'email', example: 'lea.dupont@example.com' })
  email: string;

  @ApiProperty({ example: 'Léa' })
  firstName: string;

  @ApiProperty({ example: 'Dupont' })
  lastName: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.PARTICIPANT })
  role: Role;
}
