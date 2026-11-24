import type { CreateEventInput } from '../../api/types';
import type { FormErrors } from '../auth/validation';

/**
 * Valeurs saisies dans le formulaire de création (US08), telles que les champs les donnent.
 * Les noms reprennent ceux de l'API (`CreateEventDto`) pour placer ses `details` sous le bon champ ;
 * `priceCents` est saisi en euros puis converti en centimes à l'envoi.
 */
export interface EventFormValues {
  title: string;
  description: string;
  categoryId: string;
  /** `YYYY-MM-DDTHH:mm`, en heure locale (champ `datetime-local`). */
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  city: string;
  /** Prix en euros, virgule ou point décimal : « 12,50 ». */
  priceCents: string;
  capacity: string;
}

export type EventField = keyof EventFormValues | 'image';

/** Ordre d'affichage des champs : le focus va à la première erreur dans cet ordre. */
export const EVENT_FIELDS = [
  'title',
  'description',
  'categoryId',
  'startsAt',
  'endsAt',
  'venue',
  'address',
  'city',
  'priceCents',
  'capacity',
  'image',
] as const satisfies readonly EventField[];

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: '',
  description: '',
  categoryId: '',
  startsAt: '',
  endsAt: '',
  venue: '',
  address: '',
  city: '',
  priceCents: '',
  capacity: '',
};

/** Mêmes bornes que l'API (`CreateEventDto`). */
export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 5000;
export const PLACE_MAX_LENGTH = 120;
export const ADDRESS_MAX_LENGTH = 200;
export const CITY_MAX_LENGTH = 100;
export const CAPACITY_MAX = 100_000;
export const PRICE_CENTS_MAX = 1_000_000;

export const IMAGE_TYPES = ['image/jpeg', 'image/png'];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const EUROS = /^\d+([.,]\d{1,2})?$/;
const INTEGER = /^-?\d+$/;

/** Montant en euros saisi (« 12,50 ») vers des centimes (1250) ; `null` si le format est invalide. */
export function eurosToCents(value: string): number | null {
  const amount = value.trim();
  if (!EUROS.test(amount)) return null;
  return Math.round(Number(amount.replace(',', '.')) * 100);
}

/** Valeur d'un champ `datetime-local` (heure locale) vers une date-heure ISO 8601 en UTC. */
export function localDateTimeToIso(value: string): string | null {
  const time = new Date(value).getTime();
  return value && !Number.isNaN(time) ? new Date(time).toISOString() : null;
}

/** Date-heure locale au format des champs `datetime-local`, à la minute. */
export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Contrôle de l'image avant l'envoi : JPG ou PNG, 2 Mo maximum (l'API vérifie aussi le contenu). */
export function validateImage(file: File | null): string | undefined {
  if (!file) return undefined;
  if (!IMAGE_TYPES.includes(file.type)) return "L'image doit être au format JPG ou PNG";
  if (file.size > MAX_IMAGE_BYTES) return "L'image ne doit pas dépasser 2 Mo";
  return undefined;
}

/** Mêmes règles et mêmes messages que l'API (`CreateEventDto`), plus le contrôle de l'image. */
export function validateEventForm(
  values: EventFormValues,
  image: File | null,
  now: Date = new Date(),
): FormErrors<EventField> {
  const fields: FormErrors<EventField>['fields'] = {};

  const title = values.title.trim();
  if (!title) fields.title = 'Le titre est obligatoire';
  else if (title.length < TITLE_MIN_LENGTH)
    fields.title = `Le titre doit contenir au moins ${TITLE_MIN_LENGTH} caractères`;
  else if (title.length > TITLE_MAX_LENGTH)
    fields.title = `Le titre ne doit pas dépasser ${TITLE_MAX_LENGTH} caractères`;

  const description = values.description.trim();
  if (!description) fields.description = 'La description est obligatoire';
  else if (description.length > DESCRIPTION_MAX_LENGTH)
    fields.description = `La description ne doit pas dépasser ${DESCRIPTION_MAX_LENGTH} caractères`;

  if (!values.categoryId) fields.categoryId = 'La catégorie est obligatoire';

  const startsAt = localDateTimeToIso(values.startsAt);
  if (!values.startsAt) fields.startsAt = 'La date de début est obligatoire';
  else if (!startsAt) fields.startsAt = 'La date de début doit être une date-heure valide';
  else if (new Date(startsAt).getTime() <= now.getTime())
    fields.startsAt = 'La date de début doit être dans le futur';

  if (values.endsAt) {
    const endsAt = localDateTimeToIso(values.endsAt);
    if (!endsAt) fields.endsAt = 'La date de fin doit être une date-heure valide';
    else if (startsAt && endsAt <= startsAt)
      fields.endsAt = 'La date de fin doit être postérieure à la date de début';
  }

  const venue = values.venue.trim();
  if (!venue) fields.venue = 'Le lieu est obligatoire';
  else if (venue.length > PLACE_MAX_LENGTH)
    fields.venue = `Le lieu ne doit pas dépasser ${PLACE_MAX_LENGTH} caractères`;
  if (values.address.trim().length > ADDRESS_MAX_LENGTH)
    fields.address = `L'adresse ne doit pas dépasser ${ADDRESS_MAX_LENGTH} caractères`;
  const city = values.city.trim();
  if (!city) fields.city = 'La ville est obligatoire';
  else if (city.length > CITY_MAX_LENGTH)
    fields.city = `La ville ne doit pas dépasser ${CITY_MAX_LENGTH} caractères`;

  const price = values.priceCents.trim();
  const cents = eurosToCents(price);
  if (!price) fields.priceCents = 'Le prix est obligatoire (0 pour un événement gratuit)';
  else if (price.startsWith('-')) fields.priceCents = 'Le prix doit être positif ou nul';
  else if (cents === null)
    fields.priceCents = 'Le prix doit être un montant en euros, par exemple 12,50';
  else if (cents > PRICE_CENTS_MAX) fields.priceCents = 'Le prix ne doit pas dépasser 10 000 €';

  const capacity = values.capacity.trim();
  if (!capacity) fields.capacity = 'La capacité est obligatoire';
  else if (!INTEGER.test(capacity)) fields.capacity = 'La capacité doit être un nombre entier';
  else if (Number(capacity) < 1) fields.capacity = "La capacité doit être d'au moins 1 place";
  else if (Number(capacity) > CAPACITY_MAX)
    fields.capacity = 'La capacité ne doit pas dépasser 100 000 places';

  const imageError = validateImage(image);
  if (imageError) fields.image = imageError;

  return { fields };
}

/** Corps de `POST /events`, à partir de valeurs déjà validées. */
export function toCreateEventInput(values: EventFormValues): CreateEventInput {
  const address = values.address.trim();
  const endsAt = values.endsAt ? localDateTimeToIso(values.endsAt) : null;
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId,
    startsAt: localDateTimeToIso(values.startsAt)!,
    ...(endsAt && { endsAt }),
    venue: values.venue.trim(),
    ...(address && { address }),
    city: values.city.trim(),
    priceCents: eurosToCents(values.priceCents)!,
    capacity: Number(values.capacity.trim()),
  };
}
