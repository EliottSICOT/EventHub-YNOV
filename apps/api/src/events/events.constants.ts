export const EVENT_NOT_FOUND_MESSAGE = "L'événement demandé n'existe pas";

export const MANAGE_EVENT_MESSAGES = {
  notOrganizer: "Seul l'organisateur de l'événement peut le modifier ou le supprimer",
  alreadyCancelled: 'Cet événement est annulé',
  past: 'Impossible de modifier ou de supprimer un événement qui a déjà commencé',
  capacityBelowRegistrations: (registered: number) =>
    `La capacité ne peut pas être inférieure au nombre d'inscrits (${registered})`,
} as const;
