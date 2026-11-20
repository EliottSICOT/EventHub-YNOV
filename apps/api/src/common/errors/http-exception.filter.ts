import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorDto } from './api-error.dto.js';
import { ValidationException } from './validation.exception.js';

const STATUS_LABELS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/** Convertit toute exception en `ApiErrorDto`. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (statusCode >= 500) {
      this.logger.error(exception);
    }

    const body: ApiErrorDto = {
      statusCode,
      error: STATUS_LABELS[statusCode] ?? 'Error',
      message: this.messageOf(exception, statusCode),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    if (exception instanceof ValidationException) {
      body.details = exception.details;
    }

    response.status(statusCode).json(body);
  }

  private messageOf(exception: unknown, statusCode: number): string {
    if (statusCode >= 500 || !(exception instanceof HttpException)) {
      return 'Une erreur inattendue est survenue';
    }
    if (statusCode === 404 && exception.message.startsWith('Cannot ')) {
      return "La ressource demandée n'existe pas";
    }
    return exception.message;
  }
}
