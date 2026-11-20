import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard.js';
import type { UserDto } from './dto/user.dto.js';

/** Utilisateur attaché par `AuthGuard`. À n'utiliser que sur une route protégée par ce guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserDto | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
