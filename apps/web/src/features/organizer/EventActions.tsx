import { Button } from '@heroui/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../api/client';
import type { EventDetail } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { linkButton } from '../../components/ui';
import { useMe } from '../auth/api';
import { formatDateTime } from '../events/format';
import { useDeleteEvent } from './api';
import { ExportRegistrationsButton } from './ExportRegistrationsButton';

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
 * Actions de l'organisateur, sur le détail d'un événement, visibles seulement pour lui.
 * Modifier et Supprimer (US09), tant que l'événement n'est ni annulé ni commencé ;
 * Exporter en CSV (US13), toujours : la liste sert aussi après un événement ou une annulation.
 */
export function EventActions({ event, now: nowProp }: EventActionsProps) {
  const [now] = useState(() => nowProp ?? Date.now());
  const { data: user } = useMe();
  const deleteEvent = useDeleteEvent(event.id);
  const [confirming, setConfirming] = useState(false);

  const registered = event.capacity - event.remainingSeats;
  const isOrganizer = user?.id === event.organizer.id;
  const manageable = isOrganizer && !event.isCancelled && new Date(event.startsAt).getTime() > now;

  return (
    <>
      {deleteEvent.isSuccess && (
        <Notice tone="success" role="status">
          Événement supprimé : il n'apparaît plus dans le catalogue, et ses inscrits le voient «
          Événement annulé ».
        </Notice>
      )}
      {deleteEvent.isError && (
        <Notice tone="danger" role="alert">
          {deleteErrorMessage(deleteEvent.error)}
        </Notice>
      )}
      {isOrganizer && (
        <div
          className="flex flex-wrap items-start gap-2 rounded-2xl border border-separator bg-surface p-3"
          role="group"
          aria-label="Gérer cet événement"
        >
          {manageable && (
            <>
              <Link
                to={`/organisateur/evenements/${event.id}/modifier`}
                className={linkButton('primary', 'sm')}
              >
                Modifier
              </Link>
              <Button
                variant="danger-soft"
                size="sm"
                onPress={() => {
                  deleteEvent.reset();
                  setConfirming(true);
                }}
              >
                Supprimer
              </Button>
            </>
          )}
          <Link
            to={`/organisateur/evenements/${event.id}/inscrits`}
            className={linkButton('outline', 'sm')}
          >
            Voir les inscrits
          </Link>
          <ExportRegistrationsButton eventId={event.id} />
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
