import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../../api/client';
import { useCategories } from '../../api/queries';
import type { CreateEventInput } from '../../api/types';
import { StatusMessage } from '../../components/StatusMessage';
import { errorsFromApi, type FormErrors } from '../auth/validation';
import { useCreateEvent, useUploadEventImage } from './api';
import { CreateEventForm } from './CreateEventForm';
import { EVENT_FIELDS, type EventField } from './eventForm';

/** État transmis à la page détail après une création (US08). */
export interface CreatedEventState {
  created: true;
  /** Raison de l'échec de l'envoi de l'image ; l'événement, lui, est créé. */
  imageError?: string;
}

function imageErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.body?.details?.[0]?.message ?? error.message;
  return 'Impossible de contacter le serveur.';
}

/**
 * Écran « Créer un événement » (US08), réservé aux organisateurs.
 * Crée l'événement, envoie ensuite l'image s'il y en a une, puis ouvre la page détail.
 */
export function CreateEventPage() {
  const navigate = useNavigate();
  const categories = useCategories();
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
    <section className="page organizer">
      <header className="auth__header">
        <h1>Créer un événement</h1>
        <p className="muted">L'événement sera visible dans le catalogue dès sa création.</p>
      </header>
      {categories.isError ? (
        <StatusMessage variant="error" title="Impossible de charger les catégories">
          <button type="button" className="button" onClick={() => void categories.refetch()}>
            Réessayer
          </button>
        </StatusMessage>
      ) : (
        <CreateEventForm
          categories={categories.data}
          onSubmit={(input, image) => void submit(input, image)}
          submitting={createEvent.isPending || uploadImage.isPending}
          serverErrors={serverErrors}
        />
      )}
      <p className="auth__switch">
        <Link to="/events">Annuler et revenir aux événements</Link>
      </p>
    </section>
  );
}
