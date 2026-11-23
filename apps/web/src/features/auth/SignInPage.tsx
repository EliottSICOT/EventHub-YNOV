import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import type { SignInInput } from '../../api/types';
import { StatusMessage } from '../../components/StatusMessage';
import { useSignIn } from './api';
import { SignInForm } from './SignInForm';
import {
  errorsFromApi,
  safeRedirect,
  SIGN_IN_FIELDS,
  type FormErrors,
  type SignInField,
} from './validation';

interface SignInLocationState {
  accountCreated?: boolean;
  email?: string;
}

/** Écran « Connexion » (US04) : renvoie vers la page d'origine (`?redirect=`) une fois connecté. */
export function SignInPage() {
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));
  const state = (useLocation().state ?? {}) as SignInLocationState;
  const navigate = useNavigate();
  const signIn = useSignIn();
  const [serverErrors, setServerErrors] = useState<FormErrors<SignInField>>();

  const submit = async (values: SignInInput) => {
    try {
      await signIn.mutateAsync(values);
      navigate(redirect, { replace: true });
    } catch (error) {
      // Le 401 porte le message générique de l'API, sans dire quel champ est faux.
      setServerErrors(errorsFromApi(error, SIGN_IN_FIELDS));
    }
  };

  return (
    <section className="page auth">
      <header className="auth__header">
        <h1>Connexion</h1>
      </header>
      {state.accountCreated && (
        <StatusMessage title="Votre compte est créé">
          <p>Connectez-vous pour continuer.</p>
        </StatusMessage>
      )}
      <SignInForm
        onSubmit={(values) => void submit(values)}
        submitting={signIn.isPending}
        serverErrors={serverErrors}
        defaultEmail={state.email}
      />
      <p className="auth__switch">
        Pas encore de compte ?{' '}
        <Link to={`/inscription?redirect=${encodeURIComponent(redirect)}`}>Créer un compte</Link>
      </p>
    </section>
  );
}
