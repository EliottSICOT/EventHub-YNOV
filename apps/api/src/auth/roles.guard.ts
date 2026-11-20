import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../generated/prisma/enums.js';
import { AUTH_MESSAGES } from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.guard.js';

export const ROLES_KEY = 'roles';

/**
 * Restreint une route à certains rôles. À combiner avec `AuthGuard`, placé avant :
 * `@UseGuards(AuthGuard, RolesGuard) @Roles(Role.ORGANIZER)`.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.unauthenticated);
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException(AUTH_MESSAGES.forbidden);
    }
    return true;
  }
}
