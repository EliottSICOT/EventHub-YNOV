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
import { pageSubtitle, pageTitle, textLink } from '../../components/ui';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { Card } from '@heroui/react';

/** Écran « Inscription » (US04) : crée le compte puis connecte automatiquement. */
export function SignUpPage() {
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));
  const navigate = useNavigate();
  const signUp = useSignUp();
  useDocumentTitle('Créer un compte');
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
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className={pageTitle}>Créer un compte</h1>
        <p className={pageSubtitle}>Inscrivez-vous pour réserver vos places.</p>
      </header>
      <Card className="p-6 sm:p-8">
        <SignUpForm
          onSubmit={(values) => void submit(values)}
          submitting={signUp.isPending || signIn.isPending}
          serverErrors={serverErrors}
        />
      </Card>
      <p className="text-sm text-muted">
        Déjà inscrit ?{' '}
        <Link to={`/connexion?redirect=${encodeURIComponent(redirect)}`} className={textLink}>
          Se connecter
        </Link>
      </p>
    </section>
  );
}
