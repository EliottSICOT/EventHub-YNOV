import { useEffect, useState } from 'react';

/**
 * Champ texte dont la valeur n'est appliquée qu'après une pause de frappe.
 * `applied` est la valeur en vigueur (celle de l'URL) ; quand elle change ailleurs
 * (bouton Précédent, réinitialisation), le champ se resynchronise.
 */
export function useDebouncedText(
  applied: string | undefined,
  apply: (value: string | undefined) => void,
  delayMs: number,
) {
  const [text, setText] = useState(applied ?? '');
  const [synced, setSynced] = useState(applied);
  const [sent, setSent] = useState(applied);

  if (applied !== synced) {
    setSynced(applied);
    // Retour de notre propre envoi : ne pas toucher à la saisie, qui a pu continuer
    // (lettres suivantes, espace avant le prochain mot).
    if (applied !== sent) {
      setSent(applied);
      setText(applied ?? '');
    }
  }

  useEffect(() => {
    const next = text.trim() || undefined;
    if (next === applied) return;
    const timer = setTimeout(() => {
      setSent(next);
      apply(next);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [text, applied, apply, delayMs]);

  return [text, setText] as const;
}
