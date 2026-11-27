import { Alert } from '@heroui/react';
import type { ReactNode } from 'react';

interface NoticeProps {
  tone: 'success' | 'warning' | 'danger';
  /** `status` pour une confirmation, `alert` pour une erreur ; absent pour un simple bandeau. */
  role?: 'status' | 'alert';
  children: ReactNode;
}

/** Bandeau de confirmation ou d'erreur après une action (HeroUI Alert). */
export function Notice({ tone, role, children }: NoticeProps) {
  return (
    <Alert status={tone} className="py-3">
      <Alert.Indicator aria-hidden="true" />
      <Alert.Content>
        <div className="text-sm text-foreground" role={role}>
          {children}
        </div>
      </Alert.Content>
    </Alert>
  );
}
