import { Button } from '@heroui/react';
import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import type { SignUpInput } from '../../api/types';
import { TextField } from './TextField';
import { useFormErrors } from './useFormErrors';
import {
  hasErrors,
  PASSWORD_MIN_LENGTH,
  SIGN_UP_FIELDS,
  validateSignUp,
  type FormErrors,
  type SignUpField,
} from './validation';

interface SignUpFormProps {
  onSubmit: (values: SignUpInput) => void;
  submitting?: boolean;
  /** Erreurs renvoyées par l'API (400 champ par champ, 409, erreur réseau…). */
  serverErrors?: FormErrors<SignUpField>;
}

/** Formulaire d'inscription (US04) : validé côté Front avant l'envoi. */
export function SignUpForm({ onSubmit, submitting = false, serverErrors }: SignUpFormProps) {
  const id = useId();
  const [values, setValues] = useState<SignUpInput>({
    lastName: '',
    firstName: '',
    email: '',
    password: '',
  });
  const { errors, show, clearField, reset, fieldRef, formAlertRef } = useFormErrors(
    SIGN_UP_FIELDS,
    serverErrors,
  );

  const change = (field: SignUpField) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: e.target.value }));
    clearField(field);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local = validateSignUp(values);
    if (hasErrors(local)) {
      show(local);
      return;
    }
    reset();
    onSubmit({
      ...values,
      email: values.email.trim(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
    });
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate aria-label="Inscription">
      {errors.form && (
        <p
          ref={formAlertRef}
          className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground"
          role="alert"
          tabIndex={-1}
        >
          {errors.form}
        </p>
      )}
      <TextField
        ref={fieldRef('lastName')}
        id={`${id}-lastName`}
        label="Nom"
        autoComplete="family-name"
        maxLength={100}
        value={values.lastName}
        onChange={change('lastName')}
        error={errors.fields.lastName}
      />
      <TextField
        ref={fieldRef('firstName')}
        id={`${id}-firstName`}
        label="Prénom"
        autoComplete="given-name"
        maxLength={100}
        value={values.firstName}
        onChange={change('firstName')}
        error={errors.fields.firstName}
      />
      <TextField
        ref={fieldRef('email')}
        id={`${id}-email`}
        label="Email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={change('email')}
        error={errors.fields.email}
      />
      <TextField
        ref={fieldRef('password')}
        id={`${id}-password`}
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        hint={`${PASSWORD_MIN_LENGTH} caractères minimum`}
        value={values.password}
        onChange={change('password')}
        error={errors.fields.password}
      />
      <Button type="submit" size="lg" className="mt-2 self-start" isDisabled={submitting}>
        {submitting ? 'Création du compte…' : 'Créer mon compte'}
      </Button>
    </form>
  );
}
