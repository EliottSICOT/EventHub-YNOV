import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
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
import { Roles, RolesGuard } from '../auth/roles.guard.js';
import { ApiErrorDto } from '../common/errors/api-error.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { EventDetailDto } from './dto/event-detail.dto.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import { PaginatedEventsDto } from './dto/paginated-events.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import {
  IMAGE_FIELD,
  ImageUploadInterceptor,
  MAX_IMAGE_BYTES,
  type UploadedImage,
} from './event-image.js';
import { EventImagesService } from './event-images.service.js';
import {
  capacityTooLowExample,
  createdEventExample,
  createEventExample,
  createForbiddenExample,
  createUnauthenticatedExample,
  createValidationErrorExample,
  eventCancelledExample,
  eventPastExample,
  eventWithImageExample,
  imageForbiddenExample,
  imageFormatErrorExample,
  imageNotFoundExample,
  imageTooLargeExample,
  imageUnauthenticatedExample,
  manageForbiddenExample,
  manageNotFoundExample,
  manageUnauthenticatedExample,
  unknownCategoryExample,
} from './events.examples.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly eventImagesService: EventImagesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Catalogue paginé des événements',
    description:
      'US01, US02 et US10 : liste filtrable par période, catégorie et ville, avec recherche par mots et tri (par date croissante par défaut). Tout se combine.',
  })
  @ApiOkResponse({ type: PaginatedEventsDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Paramètre de requête invalide',
  })
  listEvents(@Query() query: ListEventsQueryDto): Promise<PaginatedEventsDto> {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détail d'un événement",
    description:
      'US03 : description, organisateur, date, lieu et places restantes. Un événement supprimé (US09) reste consultable, avec `isCancelled` à vrai.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'événement" })
  @ApiOkResponse({ type: EventDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Événement inconnu' })
  getEvent(@Param('id') id: string): Promise<EventDetailDto> {
    return this.eventsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: 'Créer un événement',
    description:
      "US08 : réservé aux organisateurs. L'organisateur est l'utilisateur connecté. L'événement apparaît aussitôt dans le catalogue public. L'image, facultative, s'envoie ensuite sur `POST /events/{id}/image`.",
  })
  @ApiBody({ type: CreateEventDto, examples: { concert: { value: createEventExample } } })
  @ApiCreatedResponse({
    type: EventDetailDto,
    description: 'Événement créé',
    example: createdEventExample,
  })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Champs invalides (détail par champ), ou catégorie inconnue',
    examples: {
      validation: { summary: 'Champs invalides', value: createValidationErrorExample },
      unknownCategory: { summary: 'Catégorie inconnue', value: unknownCategoryExample },
    },
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: createUnauthenticatedExample,
  })
  @ApiForbiddenResponse({
    type: ApiErrorDto,
    description: "L'utilisateur connecté n'est pas organisateur",
    example: createForbiddenExample,
  })
  createEvent(@Body() body: CreateEventDto, @CurrentUser() user: UserDto): Promise<EventDetailDto> {
    return this.eventsService.create(body, user.id);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: 'Modifier un événement',
    description:
      "US09 : réservé à l'organisateur de l'événement, tant qu'il n'a pas commencé. Remplace tous les champs, avec les validations de la création ; un champ facultatif absent est effacé. La capacité ne peut pas passer sous le nombre d'inscrits.",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'événement" })
  @ApiBody({ type: UpdateEventDto, examples: { concert: { value: createEventExample } } })
  @ApiOkResponse({
    type: EventDetailDto,
    description: 'Événement modifié',
    example: createdEventExample,
  })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Champs invalides, catégorie inconnue ou capacité trop basse',
    examples: {
      capacity: { summary: "Capacité sous le nombre d'inscrits", value: capacityTooLowExample },
    },
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: manageUnauthenticatedExample,
  })
  @ApiForbiddenResponse({
    type: ApiErrorDto,
    description: "L'utilisateur connecté n'est pas l'organisateur de l'événement",
    example: manageForbiddenExample,
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Événement inconnu',
    example: manageNotFoundExample,
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Événement annulé, ou déjà commencé',
    examples: {
      cancelled: { summary: 'Événement annulé', value: eventCancelledExample },
      past: { summary: 'Événement déjà commencé', value: eventPastExample },
    },
  })
  updateEvent(
    @Param('id') id: string,
    @Body() body: UpdateEventDto,
    @CurrentUser() user: UserDto,
  ): Promise<EventDetailDto> {
    return this.eventsService.update(id, body, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: 'Supprimer un événement',
    description:
      "US09 : réservé à l'organisateur de l'événement, tant qu'il n'a pas commencé. L'événement sort du catalogue et n'accepte plus d'inscription ; les inscrits le voient « Événement annulé ».",
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'événement" })
  @ApiNoContentResponse({ description: 'Événement supprimé' })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: manageUnauthenticatedExample,
  })
  @ApiForbiddenResponse({
    type: ApiErrorDto,
    description: "L'utilisateur connecté n'est pas l'organisateur de l'événement",
    example: manageForbiddenExample,
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Événement inconnu',
    example: manageNotFoundExample,
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Événement annulé, ou déjà commencé',
    examples: {
      cancelled: { summary: 'Événement annulé', value: eventCancelledExample },
      past: { summary: 'Événement déjà commencé', value: eventPastExample },
    },
  })
  deleteEvent(@Param('id') id: string, @CurrentUser() user: UserDto): Promise<void> {
    return this.eventsService.cancel(id, user.id);
  }

  @Post(':id/image')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @UseInterceptors(ImageUploadInterceptor)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: "Ajouter ou remplacer l'image d'un événement",
    description: `US08 : réservé à l'organisateur de l'événement. Formats JPG et PNG uniquement (type vérifié sur le contenu du fichier, pas sur son extension), ${MAX_IMAGE_BYTES / 1024 / 1024} Mo maximum. Le fichier est renommé avec un identifiant aléatoire et servi sous \`/uploads\`.`,
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'événement" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [IMAGE_FIELD],
      properties: {
        [IMAGE_FIELD]: { type: 'string', format: 'binary', description: 'Fichier JPG ou PNG' },
      },
    },
  })
  @ApiOkResponse({
    type: EventDetailDto,
    description: "Image enregistrée ; renvoie l'événement avec son `imageUrl`",
    example: eventWithImageExample,
  })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Fichier absent, format autre que JPG ou PNG, ou plus de 2 Mo',
    examples: {
      format: { summary: 'Format refusé', value: imageFormatErrorExample },
      tooLarge: { summary: 'Fichier trop gros', value: imageTooLargeExample },
    },
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: imageUnauthenticatedExample,
  })
  @ApiForbiddenResponse({
    type: ApiErrorDto,
    description: "L'utilisateur connecté n'est pas l'organisateur de l'événement",
    example: imageForbiddenExample,
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Événement inconnu',
    example: imageNotFoundExample,
  })
  setEventImage(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
    @UploadedFile() image: UploadedImage | undefined,
  ): Promise<EventDetailDto> {
    return this.eventImagesService.setImage(id, user.id, image);
  }
}
