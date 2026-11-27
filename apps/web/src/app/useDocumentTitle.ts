import { useEffect } from 'react';

/** Titre de l'onglet propre à chaque écran (WCAG 2.4.2) : « Titre – EventHub ». */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} – EventHub` : 'EventHub';
  }, [title]);
}
