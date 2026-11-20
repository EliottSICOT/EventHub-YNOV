import type { ReactNode } from 'react';

interface StatusMessageProps {
  variant?: 'info' | 'error';
  title: string;
  children?: ReactNode;
}

/** Message d'état partagé : liste vide, erreur, ressource introuvable. */
export function StatusMessage({ variant = 'info', title, children }: StatusMessageProps) {
  return (
    <div className={`status status--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <p className="status__title">{title}</p>
      {children && <div className="status__body">{children}</div>}
    </div>
  );
}
