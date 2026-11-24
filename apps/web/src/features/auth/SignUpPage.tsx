import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { SignUpInput } from '../../api/types';
import { useSignIn, useSignUp } from './api';
import { SignUpForm } from './SignUpForm';
import {
  errorsFromApi,
  safeRedirect,
  SIGN_UP_FIELDS,
  type FormErrors,
  type SignUpField,
} from './validation';

/** Écran « Inscription » (US04) : crée le compte puis connecte automatiquement. */
export function SignUpPage() {
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));
  const navigate = useNavigate();
  const signUp = useSignUp();
  const signIn = useSignIn();
  const [serverErrors, setServerErrors] = useState<FormErrors<SignUpField>>();

  const submit = async (values: SignUpInput) => {
    try {
      await signUp.mutateAsync(values);
    } catch (error) {
      setServerErrors(
        errorsFromApi(error, SIGN_UP_FIELDS, {
          409: (message) => ({
            fields: { email: `${message}. Connectez-vous ou utilisez une autre adresse.` },
          }),
        }),
      );
      return;
    }

    try {
      await signIn.mutateAsync({ email: values.email, password: values.password });
      navigate(redirect, { replace: true });
    } catch {
      // Compte créé mais connexion automatique impossible : on laisse l'utilisateur se connecter.
      navigate(`/connexion?redirect=${encodeURIComponent(redirect)}`, {
        replace: true,
        state: { accountCreated: true, email: values.email },
      });
    }
  };

  return (
    <section className="page auth">
      <header className="auth__header">
        <h1>Créer un compte</h1>
        <p className="muted">Inscrivez-vous pour réserver vos places.</p>
      </header>
      <SignUpForm
        onSubmit={(values) => void submit(values)}
        submitting={signUp.isPending || signIn.isPending}
        serverErrors={serverErrors}
      />
      <p className="auth__switch">
        Déjà inscrit ?{' '}
        <Link to={`/connexion?redirect=${encodeURIComponent(redirect)}`}>Se connecter</Link>
      </p>
    </section>
  );
}
