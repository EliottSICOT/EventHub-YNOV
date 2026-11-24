import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
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
import { RegistrationDto } from './dto/registration.dto.js';
import {
  alreadyRegisteredExample,
  eventNotFoundExample,
  registrationExample,
  unauthenticatedExample,
} from './registrations.examples.js';
import { RegistrationsService } from './registrations.service.js';

@ApiTags('registrations')
@Controller('events')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post(':id/registrations')
  @UseGuards(AuthGuard)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: "S'inscrire à un événement",
    description:
      "US05 : inscrit l'utilisateur connecté, dans une transaction qui verrouille l'événement : deux inscriptions simultanées ne peuvent pas dépasser la capacité. Une inscription est refusée (409) si l'utilisateur est déjà inscrit, si l'événement est complet ou s'il est passé.",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'événement" })
  @ApiCreatedResponse({
    type: RegistrationDto,
    description: 'Inscription enregistrée ; renvoie les places restantes à jour',
    example: registrationExample,
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: unauthenticatedExample,
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Événement inconnu',
    example: eventNotFoundExample,
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Déjà inscrit, événement complet ou événement passé',
    example: alreadyRegisteredExample,
  })
  registerToEvent(@Param('id') id: string, @CurrentUser() user: UserDto): Promise<RegistrationDto> {
    return this.registrationsService.register(id, user.id);
  }
}
