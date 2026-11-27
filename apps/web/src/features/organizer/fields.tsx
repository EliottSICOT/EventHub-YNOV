import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { fieldError, fieldHint, fieldInput, fieldLabel, fieldTextArea } from '../../components/ui';

/**
 * Champs du formulaire organisateur, sur le modèle de `TextField` (auth) :
 * label associé, aide et erreur reliées au champ par `aria-describedby`, `aria-invalid` en erreur.
 */
interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

function describedBy({ id, error, hint }: FieldProps) {
  return [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
}

function FieldShell({ id, label, error, hint, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={fieldLabel} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className={fieldHint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

type TextAreaFieldProps = FieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & { ref?: Ref<HTMLTextAreaElement> };

export function TextAreaField({ id, label, error, hint, ref, ...textarea }: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <textarea
        ref={ref}
        id={id}
        className={fieldTextArea}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, label, error, hint })}
        {...textarea}
      />
    </FieldShell>
  );
}

type SelectFieldProps = FieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & { ref?: Ref<HTMLSelectElement> };

export function SelectField({
  id,
  label,
  error,
  hint,
  ref,
  children,
  ...select
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select
        ref={ref}
        id={id}
        className={fieldInput}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, label, error, hint })}
        {...select}
      >
        {children}
      </select>
    </FieldShell>
  );
}

type FileFieldProps = FieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'value'> & {
    ref?: Ref<HTMLInputElement>;
  };

export function FileField({ id, label, error, hint, ref, ...input }: FileFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        ref={ref}
        id={id}
        type="file"
        className={fieldInput}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, label, error, hint })}
        {...input}
      />
    </FieldShell>
  );
}
