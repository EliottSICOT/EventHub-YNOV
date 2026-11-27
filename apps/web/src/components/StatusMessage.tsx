import { Alert } from '@heroui/react';
import type { ReactNode } from 'react';

interface StatusMessageProps {
  variant?: 'info' | 'error';
  title: string;
  children?: ReactNode;
}

/** Message d'état partagé : liste vide, erreur, ressource introuvable. */
export function StatusMessage({ variant = 'info', title, children }: StatusMessageProps) {
  return (
    <Alert
      status={variant === 'error' ? 'danger' : 'default'}
      role={variant === 'error' ? 'alert' : 'status'}
      className="mx-auto my-6 max-w-2xl p-5"
    >
      <Alert.Indicator aria-hidden="true" />
      <Alert.Content>
        <Alert.Title className="text-base font-bold">{title}</Alert.Title>
        {children && (
          <div className="mt-2 flex flex-col items-start gap-3 text-sm text-foreground">
            {children}
          </div>
        )}
      </Alert.Content>
    </Alert>
  );
}
