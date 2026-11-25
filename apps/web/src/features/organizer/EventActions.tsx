import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../api/client';
import type { EventDetail } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useMe } from '../auth/api';
import { formatDateTime } from '../events/format';
import { useDeleteEvent } from './api';

interface EventActionsProps {
  event: EventDetail;
  /** Instant de référence pour savoir si l'événement a commencé (injectable pour les tests). */
  now?: number;
}

/** Message affiché quand la suppression échoue. */
function deleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous pour supprimer.';
    if ([403, 404, 409].includes(error.status)) return error.message;
  }
  return 'La suppression a échoué. Réessayez dans un instant.';
}

/**
 * Modifier et Supprimer (US09), sur le détail d'un événement. Visibles seulement pour son
 * organisateur, tant que l'événement n'est ni annulé ni commencé.
 */
export function EventActions({ event, now: nowProp }: EventActionsProps) {
  const [now] = useState(() => nowProp ?? Date.now());
  const { data: user } = useMe();
  const deleteEvent = useDeleteEvent(event.id);
  const [confirming, setConfirming] = useState(false);

  const registered = event.capacity - event.remainingSeats;
  const manageable =
    user?.id === event.organizer.id &&
    !event.isCancelled &&
    new Date(event.startsAt).getTime() > now;

  return (
    <>
      {deleteEvent.isSuccess && (
        <p className="notice notice--success" role="status">
          Événement supprimé : il n'apparaît plus dans le catalogue, et ses inscrits le voient «
          Événement annulé ».
        </p>
      )}
      {deleteEvent.isError && (
        <p className="notice notice--error" role="alert">
          {deleteErrorMessage(deleteEvent.error)}
        </p>
      )}
      {manageable && (
        <div className="event-actions">
          <Link
            to={`/organisateur/evenements/${event.id}/modifier`}
            className="button button--small"
          >
            Modifier
          </Link>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => {
              deleteEvent.reset();
              setConfirming(true);
            }}
          >
            Supprimer
          </button>
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title="Supprimer cet événement ?"
          confirmLabel="Oui, supprimer"
          cancelLabel="Garder l'événement"
          pending={deleteEvent.isPending}
          onConfirm={() => deleteEvent.mutate(undefined, { onSettled: () => setConfirming(false) })}
          onCancel={() => setConfirming(false)}
        >
          <p>
            <strong>{event.title}</strong> ({formatDateTime(event.startsAt)}) sera retiré du
            catalogue.{' '}
            {registered > 0 &&
              (registered === 1
                ? "La personne inscrite verra l'événement annulé. "
                : `Les ${registered} inscrits verront l'événement annulé. `)}
            Cette action est définitive.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
