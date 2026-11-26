import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { downloadRegistrationsCsv } from './downloadRegistrationsCsv';

interface ExportRegistrationsButtonProps {
  eventId: string;
}

/** Message affiché quand l'export échoue. */
function exportErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous pour exporter.';
    if (error.status === 403) {
      return "Vous n'avez pas accès à la liste des inscrits : seul l'organisateur de l'événement peut l'exporter.";
    }
    if (error.status === 404) return error.message;
    return "L'export a échoué. Réessayez dans un instant.";
  }
  return 'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.';
}

/**
 * « Exporter en CSV » (US13) : télécharge la liste des inscrits d'un événement. Ne dépend que
 * de l'id de l'événement, pour servir aussi bien sur le détail que dans le tableau de bord (US12).
 * L'API vérifie que l'utilisateur est l'organisateur ; c'est à l'appelant de ne l'afficher qu'à lui.
 */
export function ExportRegistrationsButton({ eventId }: ExportRegistrationsButtonProps) {
  const exportCsv = useMutation({ mutationFn: () => downloadRegistrationsCsv(eventId) });

  return (
    <div className="export-registrations">
      <button
        type="button"
        className="button button--ghost button--small"
        onClick={() => exportCsv.mutate()}
        disabled={exportCsv.isPending}
        aria-busy={exportCsv.isPending}
      >
        {exportCsv.isPending ? 'Export en cours…' : 'Exporter en CSV'}
      </button>
      {exportCsv.isSuccess && (
        <p className="notice notice--success" role="status">
          Fichier {exportCsv.data} téléchargé.
        </p>
      )}
      {exportCsv.isError && (
        <p className="notice notice--error" role="alert">
          {exportErrorMessage(exportCsv.error)}
        </p>
      )}
    </div>
  );
}
