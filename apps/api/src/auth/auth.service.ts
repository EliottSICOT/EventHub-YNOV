import { Injectable, NotImplementedException } from '@nestjs/common';
import type { SignInDto } from './dto/sign-in.dto.js';
import type { SignUpDto } from './dto/sign-up.dto.js';
import type { UserDto } from './dto/user.dto.js';

/** Squelette : le contrat est publié avant la logique (voir le commit suivant). */
@Injectable()
export class AuthService {
  signUp(_input: SignUpDto): Promise<UserDto> {
    throw new NotImplementedException();
  }

  signIn(_input: SignInDto): Promise<{ user: UserDto; token: string }> {
    throw new NotImplementedException();
  }

  signOut(_token: string | undefined): Promise<void> {
    throw new NotImplementedException();
  }

  me(): UserDto {
    throw new NotImplementedException();
  }
}
