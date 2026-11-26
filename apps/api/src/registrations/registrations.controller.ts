import { Controller, Get, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
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
import { Role } from '../generated/prisma/enums.js';
import { RegistrationDto } from './dto/registration.dto.js';
import { contentDisposition, REGISTRATIONS_CSV_TYPE } from './registrations-csv.js';
import {
  alreadyRegisteredExample,
  eventNotFoundExample,
  exportNotFoundExample,
  exportNotOrganizerExample,
  exportParticipantExample,
  exportUnauthenticatedExample,
  registrationExample,
  registrationsCsvDispositionExample,
  registrationsCsvExample,
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
      "US05 : inscrit l'utilisateur connecté, dans une transaction qui verrouille l'événement : deux inscriptions simultanées ne peuvent pas dépasser la capacité. Une inscription est refusée (409) si l'utilisateur est déjà inscrit, si l'événement est annulé, complet ou passé. US11 : un e-mail de confirmation est envoyé ; un échec d'envoi n'annule pas l'inscription.",
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
    description: 'Déjà inscrit, événement annulé, complet ou passé',
    example: alreadyRegisteredExample,
  })
  registerToEvent(@Param('id') id: string, @CurrentUser() user: UserDto): Promise<RegistrationDto> {
    return this.registrationsService.register(id, user.id);
  }

  @Get(':id/registrations.csv')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: 'Exporter les inscrits en CSV',
    description:
      "US13 : réservé à l'organisateur de l'événement. Fichier lisible tel quel dans Excel en français : BOM UTF-8, séparateur `;`, fins de ligne CRLF. Colonnes `Nom;Prénom;Email;Date d'inscription`, dates `JJ/MM/AAAA HH:mm` à l'heure de Paris, inscrits triés par date d'inscription. Une valeur qui commence par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot est préfixée d'une apostrophe (injection de formules). Sans inscrit, le fichier ne contient que la ligne d'en-tête. Nom du fichier : `inscrits-<titre-en-slug>-<AAAA-MM-JJ>.csv`, dans `Content-Disposition`.",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'événement" })
  @ApiOkResponse({
    description: 'Fichier CSV des inscrits',
    content: {
      'text/csv': {
        schema: { type: 'string' },
        example: registrationsCsvExample,
      },
    },
    headers: {
      'Content-Disposition': {
        description:
          'Pièce jointe : `filename` en ASCII, `filename*` en UTF-8 avec les accents du titre',
        schema: { type: 'string', example: registrationsCsvDispositionExample },
      },
    },
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: exportUnauthenticatedExample,
  })
  @ApiForbiddenResponse({
    type: ApiErrorDto,
    description: "Participant, ou organisateur d'un autre événement",
    examples: {
      notOrganizer: { summary: 'Autre organisateur', value: exportNotOrganizerExample },
      participant: { summary: 'Participant', value: exportParticipantExample },
    },
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Événement inconnu',
    example: exportNotFoundExample,
  })
  async exportRegistrations(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
  ): Promise<StreamableFile> {
    const csv = await this.registrationsService.exportCsv(id, user.id);
    return new StreamableFile(Buffer.from(csv.content, 'utf8'), {
      type: REGISTRATIONS_CSV_TYPE,
      disposition: contentDisposition(csv),
    });
  }
}
