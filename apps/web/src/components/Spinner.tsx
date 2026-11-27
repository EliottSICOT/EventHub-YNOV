import { Spinner as HeroSpinner } from '@heroui/react';

/** Chargement d'un écran : le libellé (en français) est annoncé, l'animation est masquée. */
export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 py-16 text-muted"
      role="status"
      aria-live="polite"
    >
      <HeroSpinner aria-hidden="true" role="presentation" color="accent" size="md" />
      <span>{label}</span>
    </div>
  );
}
