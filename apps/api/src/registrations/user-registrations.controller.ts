import { Controller, Delete, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SESSION_SECURITY } from '../auth/auth.controller.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UserDto } from '../auth/dto/user.dto.js';
import { ApiErrorDto } from '../common/errors/api-error.dto.js';
import { UserRegistrationDto } from './dto/user-registration.dto.js';
import {
  cancelPastExample,
  notFoundExample,
  notOwnerExample,
  unauthenticatedCancelExample,
  unauthenticatedListExample,
  userRegistrationsExample,
} from './registrations.examples.js';
import { RegistrationsService } from './registrations.service.js';

@ApiTags('registrations')
@Controller('registrations')
@UseGuards(AuthGuard)
@ApiCookieAuth(SESSION_SECURITY)
export class UserRegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Mes inscriptions',
    description:
      "US06 : inscriptions de l'utilisateur connecté, de l'événement le plus proche au plus lointain, passées comprises (l'annulation n'est possible que pour les événements à venir).",
  })
  @ApiOkResponse({
    type: [UserRegistrationDto],
    description: 'Liste vide si aucune inscription',
    example: userRegistrationsExample,
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: unauthenticatedListExample,
  })
  listMyRegistrations(@CurrentUser() user: UserDto): Promise<UserRegistrationDto[]> {
    return this.registrationsService.listForUser(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Annuler une inscription',
    description:
      "US06 : supprime l'inscription et libère la place (les places restantes augmentent de 1). Réservé au propriétaire de l'inscription (403 sinon) ; impossible pour un événement passé (409).",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'inscription" })
  @ApiNoContentResponse({ description: 'Inscription annulée' })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: unauthenticatedCancelExample,
  })
  @ApiForbiddenResponse({
    type: ApiErrorDto,
    description: "L'inscription appartient à un autre utilisateur",
    example: notOwnerExample,
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Inscription inconnue (ou déjà annulée)',
    example: notFoundExample,
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Événement déjà passé',
    example: cancelPastExample,
  })
  cancelRegistration(@Param('id') id: string, @CurrentUser() user: UserDto): Promise<void> {
    return this.registrationsService.cancel(id, user.id);
  }
}
