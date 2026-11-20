import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../generated/prisma/enums.js';
import type { UserDto } from './dto/user.dto.js';
import { ROLES_KEY, RolesGuard } from './roles.guard.js';

function contextFor(user: UserDto | undefined, roles?: Role[]): ExecutionContext {
  const handler = () => undefined;
  if (roles) Reflect.defineMetadata(ROLES_KEY, roles, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const user = (role: Role): UserDto => ({
  id: 'u1',
  email: 'u@example.com',
  firstName: 'U',
  lastName: 'Test',
  role,
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('laisse passer une route sans @Roles', () => {
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('laisse passer un utilisateur qui a le rôle', () => {
    expect(guard.canActivate(contextFor(user(Role.ORGANIZER), [Role.ORGANIZER]))).toBe(true);
  });

  it("refuse (403) un utilisateur qui n'a pas le rôle", () => {
    expect(() => guard.canActivate(contextFor(user(Role.PARTICIPANT), [Role.ORGANIZER]))).toThrow(
      ForbiddenException,
    );
  });

  it('refuse (401) une requête sans utilisateur', () => {
    expect(() => guard.canActivate(contextFor(undefined, [Role.ORGANIZER]))).toThrow(
      UnauthorizedException,
    );
  });
});
