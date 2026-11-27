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
import { pageTitle, textLink } from '../../components/ui';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { Card } from '@heroui/react';

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
  useDocumentTitle('Connexion');
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
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className={pageTitle}>Connexion</h1>
      </header>
      {state.accountCreated && (
        <StatusMessage title="Votre compte est créé">
          <p>Connectez-vous pour continuer.</p>
        </StatusMessage>
      )}
      <Card className="p-6 sm:p-8">
        <SignInForm
          onSubmit={(values) => void submit(values)}
          submitting={signIn.isPending}
          serverErrors={serverErrors}
          defaultEmail={state.email}
        />
      </Card>
      <p className="text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link to={`/inscription?redirect=${encodeURIComponent(redirect)}`} className={textLink}>
          Créer un compte
        </Link>
      </p>
    </section>
  );
}
