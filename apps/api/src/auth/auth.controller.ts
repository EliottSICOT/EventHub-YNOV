import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApiErrorDto } from '../common/errors/api-error.dto.js';
import { SESSION_COOKIE } from './auth.constants.js';
import {
  invalidCredentialsExample,
  signInValidationExample,
  signUpConflictExample,
  signUpValidationExample,
  unauthenticatedExample,
  userExample,
} from './auth.examples.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { UserDto } from './dto/user.dto.js';
import { clearSessionCookie, readSessionToken, setSessionCookie } from './session-cookie.js';

export const SESSION_SECURITY = 'session';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  /** Cookie `Secure` en production uniquement : en dev, le Front est servi en HTTP. */
  private readonly secureCookie: boolean;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.secureCookie = config.get<string>('NODE_ENV') === 'production';
  }

  @Post('sign-up')
  @ApiOperation({
    summary: 'Créer un compte participant',
    description:
      "US04 : crée un compte avec le rôle PARTICIPANT. N'ouvre pas de session : le client enchaîne avec `POST /auth/sign-in`.",
  })
  @ApiCreatedResponse({ type: UserDto, description: 'Compte créé', example: userExample })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Champ manquant ou invalide (mot de passe de moins de 8 caractères…)',
    example: signUpValidationExample,
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Email déjà utilisé',
    example: signUpConflictExample,
  })
  signUp(@Body() body: SignUpDto): Promise<UserDto> {
    return this.authService.signUp(body);
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Se connecter',
    description: `US04 : ouvre une session de 7 jours portée par le cookie HttpOnly \`${SESSION_COOKIE}\`. Des identifiants invalides renvoient toujours le même 401, sans préciser si l'email ou le mot de passe est faux.`,
  })
  @ApiOkResponse({
    type: UserDto,
    description: 'Connecté : renvoie l’utilisateur et pose le cookie de session',
    example: userExample,
    headers: {
      'Set-Cookie': {
        description: 'Cookie de session HttpOnly, SameSite=Lax, Secure en production',
        schema: {
          type: 'string',
          example: `${SESSION_COOKIE}=kq3…Zx; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax`,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Champ manquant',
    example: signInValidationExample,
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Identifiants invalides (message générique)',
    example: invalidCredentialsExample,
  })
  async signIn(
    @Body() body: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    const { user, token } = await this.authService.signIn(body);
    setSessionCookie(res, token, this.secureCookie);
    return user;
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: 'Se déconnecter',
    description:
      'US04 : supprime la session en base et efface le cookie. Idempotent : renvoie 204 même sans session valide.',
  })
  @ApiNoContentResponse({ description: 'Session supprimée' })
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.signOut(readSessionToken(req));
    clearSessionCookie(res, this.secureCookie);
  }

  @Get('me')
  @ApiCookieAuth(SESSION_SECURITY)
  @ApiOperation({
    summary: 'Utilisateur connecté',
    description:
      'US04 : renvoie l’utilisateur de la session courante (le layout affiche son prénom).',
  })
  @ApiOkResponse({ type: UserDto, example: userExample })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Pas de session, ou session expirée',
    example: unauthenticatedExample,
  })
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: UserDto): UserDto {
    return user;
  }
}
