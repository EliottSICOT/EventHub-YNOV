import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { Roles, RolesGuard } from '../auth/roles.guard.js';
import { ApiErrorDto } from '../common/errors/api-error.dto.js';
import { EventAttendeeDto } from '../events/dto/event-attendee.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { RegistrationDto } from './dto/registration.dto.js';
import {
  alreadyRegisteredExample,
  attendeesExample,
  attendeesForbiddenExample,
  attendeesNotFoundExample,
  attendeesUnauthenticatedExample,
  eventNotFoundExample,
  registrationExample,
  unauthenticatedExample,
} from './registrations.examples.js';
import { RegistrationsService } from './registrations.service.js';

@ApiTags('registrations')
@Controller('events')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get(':id/registrations')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: "Liste des inscrits d'un événement",
    description:
      "US12 : réservé à l'organisateur de l'événement. Renvoie nom, prénom, email et date d'inscription, triés par nom puis prénom.",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'événement" })
  @ApiOkResponse({
    type: [EventAttendeeDto],
    description: 'Liste vide si aucun inscrit',
    example: attendeesExample,
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: attendeesUnauthenticatedExample,
  })
  @ApiForbiddenResponse({
    type: ApiErrorDto,
    description: "Pas organisateur, ou pas l'organisateur de cet événement",
    example: attendeesForbiddenExample,
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Événement inconnu',
    example: attendeesNotFoundExample,
  })
  listEventAttendees(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
  ): Promise<EventAttendeeDto[]> {
    return this.registrationsService.listAttendees(id, user.id);
  }

  @Post(':id/registrations')
  @UseGuards(AuthGuard)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: "S'inscrire à un événement",
    description:
      "US05 : inscrit l'utilisateur connecté, dans une transaction qui verrouille l'événement : deux inscriptions simultanées ne peuvent pas dépasser la capacité. Une inscription est refusée (409) si l'utilisateur est déjà inscrit, si l'événement est complet ou s'il est passé. US11 : un e-mail de confirmation est envoyé ; un échec d'envoi n'annule pas l'inscription.",
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
