import { ApiError } from '../../api/client';
import type { SignInInput, SignUpInput } from '../../api/types';

/** Erreurs d'un formulaire : une par champ, plus une erreur générale éventuelle. */
export interface FormErrors<Field extends string> {
  fields: Partial<Record<Field, string>>;
  form?: string;
}

export type SignUpField = keyof SignUpInput;
export type SignInField = keyof SignInInput;

/** Ordre d'affichage des champs : le focus va à la première erreur dans cet ordre. */
export const SIGN_UP_FIELDS = ['lastName', 'firstName', 'email', 'password'] as const;
export const SIGN_IN_FIELDS = ['email', 'password'] as const;

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mêmes règles et mêmes messages que l'API (`SignUpDto`). */
export function validateSignUp(input: SignUpInput): FormErrors<SignUpField> {
  const fields: FormErrors<SignUpField>['fields'] = {};
  if (!input.lastName.trim()) fields.lastName = 'Le nom est obligatoire';
  else if (input.lastName.trim().length > NAME_MAX_LENGTH)
    fields.lastName = `Le nom ne doit pas dépasser ${NAME_MAX_LENGTH} caractères`;
  if (!input.firstName.trim()) fields.firstName = 'Le prénom est obligatoire';
  else if (input.firstName.trim().length > NAME_MAX_LENGTH)
    fields.firstName = `Le prénom ne doit pas dépasser ${NAME_MAX_LENGTH} caractères`;
  if (!input.email.trim()) fields.email = "L'email est obligatoire";
  else if (!EMAIL.test(input.email.trim())) fields.email = "L'email n'est pas valide";
  if (input.password.length < PASSWORD_MIN_LENGTH)
    fields.password = `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`;
  return { fields };
}

export function validateSignIn(input: SignInInput): FormErrors<SignInField> {
  const fields: FormErrors<SignInField>['fields'] = {};
  if (!input.email.trim()) fields.email = "L'email est obligatoire";
  if (!input.password) fields.password = 'Le mot de passe est obligatoire';
  return { fields };
}

export function hasErrors(errors: FormErrors<string>): boolean {
  return Boolean(errors.form) || Object.keys(errors.fields).length > 0;
}

/**
 * Traduit une erreur de l'API en erreurs de formulaire :
 * les `details` d'une 400 vont sous leur champ, le reste en message général.
 */
export function errorsFromApi<Field extends string>(
  error: unknown,
  knownFields: readonly Field[],
  overrides: Partial<Record<number, (message: string) => FormErrors<Field>>> = {},
): FormErrors<Field> {
  if (!(error instanceof ApiError)) {
    return { fields: {}, form: 'Impossible de contacter le serveur. Réessayez dans un instant.' };
  }
  const override = overrides[error.status];
  if (override) return override(error.message);

  const fields: FormErrors<Field>['fields'] = {};
  const unplaced: string[] = [];
  for (const detail of error.body?.details ?? []) {
    if ((knownFields as readonly string[]).includes(detail.field)) {
      fields[detail.field as Field] ??= detail.message;
    } else {
      unplaced.push(detail.message);
    }
  }
  if (Object.keys(fields).length > 0) {
    return { fields, form: unplaced.length > 0 ? unplaced.join('. ') : undefined };
  }
  if (error.status >= 500) {
    return { fields: {}, form: 'Une erreur inattendue est survenue. Réessayez dans un instant.' };
  }
  return { fields: {}, form: error.message };
}

/**
 * Cible de redirection après connexion : uniquement un chemin interne,
 * pour qu'un lien piégé `?redirect=https://…` ne puisse pas faire sortir de l'application.
 */
export function safeRedirect(target: string | null | undefined, fallback = '/events'): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return fallback;
  }
  return target;
}
