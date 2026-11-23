import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_MESSAGES } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { UserDto } from './dto/user.dto.js';
import { readSessionToken } from './session-cookie.js';

export type AuthenticatedRequest = Request & { user?: UserDto };

/**
 * Exige une session valide : lit le cookie, charge l'utilisateur et l'attache à `request.user`.
 * Usage : `@UseGuards(AuthGuard)` (le module appelant importe `AuthModule`).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionToken(request);
    const user = token ? await this.authService.findUserBySession(token) : null;
    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.unauthenticated);
    }
    request.user = user;
    return true;
  }
}
