import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SESSION_SECURITY } from '../auth/auth.controller.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UserDto } from '../auth/dto/user.dto.js';
import { ApiErrorDto } from '../common/errors/api-error.dto.js';
import { MyRegistrationsDto } from './dto/my-registrations.dto.js';
import {
  myRegistrationsExample,
  myRegistrationsUnauthenticatedExample,
} from './registrations.examples.js';
import { RegistrationsService } from './registrations.service.js';

@ApiTags('registrations')
@Controller('me/registrations')
export class MyRegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: 'Mes inscriptions',
    description:
      "US07 : inscriptions de l'utilisateur connecté, à venir et passées séparées. Un événement est passé dès qu'il a commencé, comme pour l'inscription.",
  })
  @ApiOkResponse({ type: MyRegistrationsDto, example: myRegistrationsExample })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: myRegistrationsUnauthenticatedExample,
  })
  listMyRegistrations(@CurrentUser() user: UserDto): Promise<MyRegistrationsDto> {
    return this.registrationsService.findByUser(user.id);
  }
}
