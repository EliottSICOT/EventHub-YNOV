import type { InputHTMLAttributes, Ref } from 'react';
import { fieldError, fieldHint, fieldInput, fieldLabel } from '../../components/ui';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  /** Aide affichée sous le champ, reliée par `aria-describedby`. */
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Champ de formulaire : label associé, aide et erreur reliées au champ pour les lecteurs d'écran. */
export function TextField({ id, label, error, hint, ref, ...input }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label className={fieldLabel} htmlFor={id}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className={fieldInput}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {hint && (
        <p id={hintId} className={fieldHint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
