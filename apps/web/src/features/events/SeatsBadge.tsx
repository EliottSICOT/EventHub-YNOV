import { Chip } from '@heroui/react';
import { isAlmostFull, seatsLabel } from './format';

interface SeatsBadgeProps {
  remainingSeats: number;
  capacity: number;
  isFull: boolean;
}

/** Jauge de places restantes (US01, US03) : le texte porte l'information, la couleur la renforce. */
export function SeatsBadge({ remainingSeats, capacity, isFull }: SeatsBadgeProps) {
  const tone = isFull ? 'full' : isAlmostFull(remainingSeats, capacity) ? 'low' : 'ok';
  const color = ({ full: 'danger', low: 'warning', ok: 'success' } as const)[tone];
  return (
    <Chip
      color={color}
      variant="soft"
      size="sm"
      data-tone={tone}
      className="font-semibold whitespace-nowrap"
    >
      {seatsLabel(remainingSeats, isFull)}
    </Chip>
  );
}
