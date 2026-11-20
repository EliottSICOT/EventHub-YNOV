import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../common/errors/api-error.dto.js';
import { EventDetailDto } from './dto/event-detail.dto.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import { PaginatedEventsDto } from './dto/paginated-events.dto.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({
    summary: 'Catalogue paginé des événements',
    description:
      'US01 et US02 : liste triée par date de début croissante, filtrable par période, catégorie et ville. Les filtres se combinent.',
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
    description: 'US03 : description, organisateur, date, lieu et places restantes.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'événement" })
  @ApiOkResponse({ type: EventDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Événement inconnu' })
  getEvent(@Param('id') id: string): Promise<EventDetailDto> {
    return this.eventsService.findOne(id);
  }
}
