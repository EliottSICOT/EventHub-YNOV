import { Button } from '@heroui/react';
import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Category, CreateEventInput } from '../../api/types';
import { TextField } from '../auth/TextField';
import { useFormErrors } from '../auth/useFormErrors';
import { hasErrors, type FormErrors } from '../auth/validation';
import {
  ADDRESS_MAX_LENGTH,
  CITY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  EMPTY_EVENT_FORM,
  EVENT_FIELDS,
  IMAGE_TYPES,
  PLACE_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  toCreateEventInput,
  toLocalDateTimeInput,
  validateEventForm,
  type EventField,
  type EventFormValues,
} from './eventForm';
import { FileField, SelectField, TextAreaField } from './fields';

const CREATE_LABELS = {
  form: 'Créer un événement',
  submit: "Créer l'événement",
  submitting: 'Création en cours…',
  image: 'JPG ou PNG, 2 Mo maximum',
};

interface CreateEventFormProps {
  /** Catégories proposées ; `undefined` pendant le chargement. */
  categories: Category[] | undefined;
  onSubmit: (input: CreateEventInput, image: File | null) => void;
  submitting?: boolean;
  /** Erreurs renvoyées par l'API (400 champ par champ, 403, erreur réseau…). */
  serverErrors?: FormErrors<EventField>;
  /** Valeurs de départ, pour modifier un événement existant (US09). */
  initialValues?: EventFormValues;
  /** Libellés, ceux de la création par défaut. */
  labels?: typeof CREATE_LABELS;
}

/** Formulaire de création (US08) ou de modification (US09) d'un événement : validé côté Front avant l'envoi. */
export function CreateEventForm({
  categories,
  onSubmit,
  submitting = false,
  serverErrors,
  initialValues = EMPTY_EVENT_FORM,
  labels = CREATE_LABELS,
}: CreateEventFormProps) {
  const id = useId();
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [image, setImage] = useState<File | null>(null);
  // Borne `min` du début : l'heure d'ouverture du formulaire (la validation recontrôle à l'envoi).
  const [minStart] = useState(() => toLocalDateTimeInput(new Date()));
  const { errors, show, clearField, reset, fieldRef, formAlertRef } = useFormErrors(
    EVENT_FIELDS,
    serverErrors,
  );

  const change =
    (field: keyof EventFormValues) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [field]: e.target.value }));
      clearField(field);
    };

  const changeImage = (e: ChangeEvent<HTMLInputElement>) => {
    setImage(e.target.files?.[0] ?? null);
    clearField('image');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local = validateEventForm(values, image);
    if (hasErrors(local)) {
      show(local);
      return;
    }
    reset();
    onSubmit(toCreateEventInput(values), image);
  };

  const field = (name: EventField) => ({
    ref: fieldRef(name),
    id: `${id}-${name}`,
    error: errors.fields[name],
  });

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate aria-label={labels.form}>
      {errors.form && (
        <p
          ref={formAlertRef}
          className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-medium text-danger-soft-foreground"
          role="alert"
          tabIndex={-1}
        >
          {errors.form}
        </p>
      )}

      <TextField
        {...field('title')}
        label="Titre"
        maxLength={TITLE_MAX_LENGTH}
        hint="Entre 3 et 120 caractères"
        value={values.title}
        onChange={change('title')}
      />
      <TextAreaField
        {...field('description')}
        label="Description"
        rows={6}
        maxLength={DESCRIPTION_MAX_LENGTH}
        value={values.description}
        onChange={change('description')}
      />
      <SelectField
        {...field('categoryId')}
        label="Catégorie"
        value={values.categoryId}
        onChange={change('categoryId')}
        disabled={!categories}
      >
        <option value="">
          {categories ? 'Choisir une catégorie' : 'Chargement des catégories…'}
        </option>
        {categories?.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          {...field('startsAt')}
          label="Date et heure de début"
          type="datetime-local"
          min={minStart}
          value={values.startsAt}
          onChange={change('startsAt')}
        />
        <TextField
          {...field('endsAt')}
          label="Date et heure de fin (facultatif)"
          type="datetime-local"
          min={values.startsAt || undefined}
          value={values.endsAt}
          onChange={change('endsAt')}
        />
      </div>

      <TextField
        {...field('venue')}
        label="Lieu"
        hint="Nom de la salle ou du site"
        maxLength={PLACE_MAX_LENGTH}
        value={values.venue}
        onChange={change('venue')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          {...field('address')}
          label="Adresse (facultatif)"
          autoComplete="street-address"
          maxLength={ADDRESS_MAX_LENGTH}
          value={values.address}
          onChange={change('address')}
        />
        <TextField
          {...field('city')}
          label="Ville"
          autoComplete="address-level2"
          maxLength={CITY_MAX_LENGTH}
          value={values.city}
          onChange={change('city')}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          {...field('priceCents')}
          label="Prix (€)"
          inputMode="decimal"
          hint="0 pour un événement gratuit"
          value={values.priceCents}
          onChange={change('priceCents')}
        />
        <TextField
          {...field('capacity')}
          label="Capacité"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          hint="Nombre de places, au moins 1"
          value={values.capacity}
          onChange={change('capacity')}
        />
      </div>

      <FileField
        {...field('image')}
        label="Image (facultatif)"
        accept={IMAGE_TYPES.join(',')}
        hint={labels.image}
        onChange={changeImage}
      />

      <Button type="submit" size="lg" className="mt-2 self-start" isDisabled={submitting}>
        {submitting ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
