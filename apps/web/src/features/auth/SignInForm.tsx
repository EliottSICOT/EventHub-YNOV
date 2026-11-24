import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import type { SignInInput } from '../../api/types';
import { TextField } from './TextField';
import { useFormErrors } from './useFormErrors';
import {
  hasErrors,
  SIGN_IN_FIELDS,
  validateSignIn,
  type FormErrors,
  type SignInField,
} from './validation';

interface SignInFormProps {
  onSubmit: (values: SignInInput) => void;
  submitting?: boolean;
  /** Erreurs renvoyées par l'API : le 401 générique arrive en erreur de formulaire. */
  serverErrors?: FormErrors<SignInField>;
  defaultEmail?: string;
}

/** Formulaire de connexion (US04). */
export function SignInForm({
  onSubmit,
  submitting = false,
  serverErrors,
  defaultEmail = '',
}: SignInFormProps) {
  const id = useId();
  const [values, setValues] = useState<SignInInput>({ email: defaultEmail, password: '' });
  const { errors, show, clearField, reset, fieldRef, formAlertRef } = useFormErrors(
    SIGN_IN_FIELDS,
    serverErrors,
  );

  const change = (field: SignInField) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: e.target.value }));
    clearField(field);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local = validateSignIn(values);
    if (hasErrors(local)) {
      show(local);
      return;
    }
    reset();
    onSubmit({ ...values, email: values.email.trim() });
  };

  return (
    <form className="form" onSubmit={submit} noValidate aria-label="Connexion">
      {errors.form && (
        <p ref={formAlertRef} className="form__alert" role="alert" tabIndex={-1}>
          {errors.form}
        </p>
      )}
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
        autoComplete="current-password"
        value={values.password}
        onChange={change('password')}
        error={errors.fields.password}
      />
      <button type="submit" className="button form__submit" disabled={submitting}>
        {submitting ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
