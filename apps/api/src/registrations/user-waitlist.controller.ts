import { Controller, Delete, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import {
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
import { UserWaitlistEntryDto } from './dto/user-waitlist-entry.dto.js';
import {
  unauthenticatedWaitlistListExample,
  userWaitlistExample,
  waitlistLeaveNotFoundExample,
  waitlistLeaveNotOwnerExample,
  waitlistLeaveUnauthenticatedExample,
} from './registrations.examples.js';
import { RegistrationsService } from './registrations.service.js';

@ApiTags('waitlist')
@Controller('waitlist')
@UseGuards(AuthGuard)
@ApiCookieAuth(SESSION_SECURITY)
export class UserWaitlistController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get('me')
  @ApiOperation({
    summary: "Mes places en liste d'attente",
    description:
      "US14 : listes d'attente de l'utilisateur connecté, de l'événement le plus proche au plus lointain, avec la position dans chaque file.",
  })
  @ApiOkResponse({
    type: [UserWaitlistEntryDto],
    description: 'Liste vide si aucune place en attente',
    example: userWaitlistExample,
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: unauthenticatedWaitlistListExample,
  })
  listMyWaitlist(@CurrentUser() user: UserDto): Promise<UserWaitlistEntryDto[]> {
    return this.registrationsService.listWaitlistForUser(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Quitter une liste d'attente",
    description:
      "US14 : retire l'entrée de la file. Réservé au propriétaire (403 sinon). Les positions des suivants avancent.",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'entrée en liste d'attente" })
  @ApiNoContentResponse({ description: 'Entrée retirée' })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: waitlistLeaveUnauthenticatedExample,
  })
  @ApiForbiddenResponse({
    type: ApiErrorDto,
    description: "L'entrée appartient à un autre utilisateur",
    example: waitlistLeaveNotOwnerExample,
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Entrée inconnue (ou déjà quittée / promue)',
    example: waitlistLeaveNotFoundExample,
  })
  leaveWaitlist(@Param('id') id: string, @CurrentUser() user: UserDto): Promise<void> {
    return this.registrationsService.leaveWaitlist(id, user.id);
  }
}
