import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useCategories, useEvent } from '../../api/queries';
import type { CreateEventInput, EventDetail } from '../../api/types';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { useMe } from '../auth/api';
import { errorsFromApi, type FormErrors } from '../auth/validation';
import { imageErrorMessage, useUpdateEvent, useUploadEventImage } from './api';
import { CreateEventForm } from './CreateEventForm';
import { EVENT_FIELDS, toEventFormValues, type EventField } from './eventForm';

/** État transmis à la page détail après une modification (US09). */
export interface UpdatedEventState {
  updated: true;
  /** Raison de l'échec de l'envoi de l'image ; l'événement, lui, est modifié. */
  imageError?: string;
}

const EDIT_LABELS = {
  form: "Modifier l'événement",
  submit: 'Enregistrer les modifications',
  submitting: 'Enregistrement en cours…',
  image: "JPG ou PNG, 2 Mo maximum. Remplace l'image actuelle",
};

/** Écran « Modifier un événement » (US09), réservé à l'organisateur de l'événement. */
export function EditEventPage() {
  const { id = '' } = useParams();
  const { data: user } = useMe();
  const { data: event, isPending, isError, error, refetch } = useEvent(id);
  const [now] = useState(() => Date.now());

  if (isPending) return <Spinner label="Chargement de l'événement…" />;

  if (isError) {
    return error instanceof ApiError && error.status === 404 ? (
      <Refusal title="Événement introuvable" message="Cet événement n'existe pas." />
    ) : (
      <StatusMessage variant="error" title="Impossible de charger l'événement">
        <button type="button" className="button" onClick={() => void refetch()}>
          Réessayer
        </button>
      </StatusMessage>
    );
  }
  if (event.organizer.id !== user?.id) {
    return (
      <Refusal
        title="Accès réservé"
        message="Seul l'organisateur de l'événement peut le modifier."
        eventId={id}
      />
    );
  }
  if (event.isCancelled) {
    return (
      <Refusal
        title="Événement annulé"
        message="Un événement annulé ne peut plus être modifié."
        eventId={id}
      />
    );
  }
  if (new Date(event.startsAt).getTime() <= now) {
    return (
      <Refusal
        title="Événement commencé"
        message="Un événement qui a déjà commencé ne peut plus être modifié."
        eventId={id}
      />
    );
  }
  return <EditEvent key={event.id} event={event} />;
}

function Refusal({
  title,
  message,
  eventId,
}: {
  title: string;
  message: string;
  eventId?: string;
}) {
  return (
    <StatusMessage variant="error" title={title}>
      <p>{message}</p>
      {eventId ? (
        <Link to={`/events/${eventId}`}>Voir l'événement</Link>
      ) : (
        <Link to="/events">Voir les événements</Link>
      )}
    </StatusMessage>
  );
}

function EditEvent({ event }: { event: EventDetail }) {
  const navigate = useNavigate();
  const categories = useCategories();
  const updateEvent = useUpdateEvent(event.id);
  const uploadImage = useUploadEventImage();
  const [serverErrors, setServerErrors] = useState<FormErrors<EventField>>();

  const submit = async (input: CreateEventInput, image: File | null) => {
    try {
      await updateEvent.mutateAsync(input);
    } catch (error) {
      setServerErrors(errorsFromApi(error, EVENT_FIELDS));
      return;
    }

    const state: UpdatedEventState = { updated: true };
    if (image) {
      try {
        await uploadImage.mutateAsync({ eventId: event.id, file: image });
      } catch (error) {
        state.imageError = imageErrorMessage(error);
      }
    }
    navigate(`/events/${event.id}`, { state });
  };

  return (
    <section className="page organizer">
      <header className="auth__header">
        <h1>Modifier un événement</h1>
        <p className="muted">Les modifications sont visibles aussitôt dans le catalogue.</p>
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
          initialValues={toEventFormValues(event)}
          labels={EDIT_LABELS}
          onSubmit={(input, image) => void submit(input, image)}
          submitting={updateEvent.isPending || uploadImage.isPending}
          serverErrors={serverErrors}
        />
      )}
      <p className="auth__switch">
        <Link to={`/events/${event.id}`}>Annuler et revenir à l'événement</Link>
      </p>
    </section>
  );
}
