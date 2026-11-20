import { BadRequestException, ValidationError } from '@nestjs/common';
import type { FieldErrorDto } from './api-error.dto.js';

export const VALIDATION_MESSAGE = 'La requête contient des champs invalides';

/** Erreur 400 portant le détail champ par champ, au format de `ApiErrorDto.details`. */
export class ValidationException extends BadRequestException {
  constructor(readonly details: FieldErrorDto[]) {
    super(VALIDATION_MESSAGE);
  }
}

export function flattenValidationErrors(
  errors: ValidationError[],
  parent?: string,
): FieldErrorDto[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function validationExceptionFactory(errors: ValidationError[]) {
  return new ValidationException(flattenValidationErrors(errors));
}
