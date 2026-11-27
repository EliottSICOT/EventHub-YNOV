import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCategories } from '../../api/queries';
import type { CreateEventInput } from '../../api/types';
import { StatusMessage } from '../../components/StatusMessage';
import { errorsFromApi, type FormErrors } from '../auth/validation';
import { imageErrorMessage, useCreateEvent, useUploadEventImage } from './api';
import { CreateEventForm } from './CreateEventForm';
import { EVENT_FIELDS, type EventField } from './eventForm';
import { Button, Card } from '@heroui/react';
import { pageSubtitle, pageTitle, textLink } from '../../components/ui';
import { useDocumentTitle } from '../../app/useDocumentTitle';

/** État transmis à la page détail après une création (US08). */
export interface CreatedEventState {
  created: true;
  /** Raison de l'échec de l'envoi de l'image ; l'événement, lui, est créé. */
  imageError?: string;
}

/**
 * Écran « Créer un événement » (US08), réservé aux organisateurs.
 * Crée l'événement, envoie ensuite l'image s'il y en a une, puis ouvre la page détail.
 */
export function CreateEventPage() {
  const navigate = useNavigate();
  const categories = useCategories();
  useDocumentTitle('Créer un événement');
  const createEvent = useCreateEvent();
  const uploadImage = useUploadEventImage();
  const [serverErrors, setServerErrors] = useState<FormErrors<EventField>>();

  const submit = async (input: CreateEventInput, image: File | null) => {
    let eventId: string;
    try {
      eventId = (await createEvent.mutateAsync(input)).id;
    } catch (error) {
      setServerErrors(errorsFromApi(error, EVENT_FIELDS));
      return;
    }

    const state: CreatedEventState = { created: true };
    if (image) {
      try {
        await uploadImage.mutateAsync({ eventId, file: image });
      } catch (error) {
        state.imageError = imageErrorMessage(error);
      }
    }
    navigate(`/events/${eventId}`, { state });
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className={pageTitle}>Créer un événement</h1>
        <p className={pageSubtitle}>L'événement sera visible dans le catalogue dès sa création.</p>
      </header>
      {categories.isError ? (
        <StatusMessage variant="error" title="Impossible de charger les catégories">
          <Button onPress={() => void categories.refetch()}>Réessayer</Button>
        </StatusMessage>
      ) : (
        <Card className="p-6 sm:p-8">
          <CreateEventForm
            categories={categories.data}
            onSubmit={(input, image) => void submit(input, image)}
            submitting={createEvent.isPending || uploadImage.isPending}
            serverErrors={serverErrors}
          />
        </Card>
      )}
      <p className="text-sm text-muted">
        <Link to="/events" className={textLink}>
          Annuler et revenir aux événements
        </Link>
      </p>
    </section>
  );
}
