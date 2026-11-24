import { useEffect, useRef, useState } from 'react';
import type { FormErrors } from './validation';

/**
 * État des erreurs d'un formulaire, avec le focus sur la première erreur
 * (dans l'ordre des champs) à chaque soumission refusée ou réponse en erreur du serveur.
 */
export function useFormErrors<Field extends string>(
  fieldOrder: readonly Field[],
  serverErrors: FormErrors<Field> | undefined,
) {
  const [errors, setErrors] = useState<FormErrors<Field>>({ fields: {} });
  const [focusRequest, setFocusRequest] = useState(0);
  const fieldRefs = useRef(new Map<Field, HTMLElement | null>());
  const formAlertRef = useRef<HTMLParagraphElement | null>(null);

  // Nouvelles erreurs renvoyées par le serveur : on les affiche et on y amène le focus.
  const [lastServerErrors, setLastServerErrors] = useState(serverErrors);
  if (serverErrors !== lastServerErrors) {
    setLastServerErrors(serverErrors);
    if (serverErrors) {
      setErrors(serverErrors);
      setFocusRequest((n) => n + 1);
    }
  }

  // Ne réagit qu'aux demandes de focus (soumission, réponse du serveur), pas à la saisie.
  const handledFocusRequest = useRef(0);
  useEffect(() => {
    if (focusRequest === handledFocusRequest.current) return;
    handledFocusRequest.current = focusRequest;
    const first = fieldOrder.find((field) => errors.fields[field]);
    if (first) fieldRefs.current.get(first)?.focus();
    else formAlertRef.current?.focus();
  }, [focusRequest, errors, fieldOrder]);

  return {
    errors,
    /** Affiche des erreurs (validation locale) et met le focus sur la première. */
    show(next: FormErrors<Field>) {
      setErrors(next);
      setFocusRequest((n) => n + 1);
    },
    /** Retire l'erreur d'un champ dès que l'utilisateur le corrige. */
    clearField(field: Field) {
      setErrors((current) =>
        current.fields[field]
          ? { ...current, fields: { ...current.fields, [field]: undefined } }
          : current,
      );
    },
    reset() {
      setErrors({ fields: {} });
    },
    fieldRef: (field: Field) => (element: HTMLElement | null) => {
      fieldRefs.current.set(field, element);
    },
    formAlertRef,
  };
}
