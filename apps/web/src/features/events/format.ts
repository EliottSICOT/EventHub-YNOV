const dateTime = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

const shortDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso));

export function seatsLabel(remainingSeats: number, isFull: boolean): string {
  if (isFull) return 'Complet';
  if (remainingSeats === 1) return 'Dernière place';
  return `${remainingSeats} places restantes`;
}

/** Jauge presque pleine : moins de 10 % ou moins de 5 places. */
export function isAlmostFull(remainingSeats: number, capacity: number): boolean {
  return remainingSeats > 0 && (remainingSeats <= 5 || remainingSeats / capacity <= 0.1);
}
