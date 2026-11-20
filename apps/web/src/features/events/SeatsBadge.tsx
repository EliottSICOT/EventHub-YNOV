import { isAlmostFull, seatsLabel } from './format';

interface SeatsBadgeProps {
  remainingSeats: number;
  capacity: number;
  isFull: boolean;
}

/** Jauge de places restantes (US01, US03). */
export function SeatsBadge({ remainingSeats, capacity, isFull }: SeatsBadgeProps) {
  const tone = isFull ? 'full' : isAlmostFull(remainingSeats, capacity) ? 'low' : 'ok';
  return <span className={`badge badge--${tone}`}>{seatsLabel(remainingSeats, isFull)}</span>;
}
