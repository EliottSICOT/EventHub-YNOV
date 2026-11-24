import {
  EMPTY_EVENT_FORM,
  eurosToCents,
  localDateTimeToIso,
  toCreateEventInput,
  toLocalDateTimeInput,
  validateEventForm,
  validateImage,
  type EventFormValues,
} from './eventForm';

const NOW = new Date(2026, 10, 24, 15, 0);

const valid: EventFormValues = {
  ...EMPTY_EVENT_FORM,
  title: '  Nuit du jazz ',
  description: 'Trois quartets.',
  categoryId: 'cat-concert',
  startsAt: '2026-12-05T19:00',
  venue: 'Le Transbordeur',
  city: 'Lyon',
  priceCents: '12,5',
  capacity: '300',
};

describe('eurosToCents', () => {
  it.each([
    ['0', 0],
    ['12', 1200],
    ['12,5', 1250],
    ['12.50', 1250],
    [' 19,99 ', 1999],
  ])('convertit « %s » en %i centimes', (input, cents) => {
    expect(eurosToCents(input)).toBe(cents);
  });

  it.each(['', '-5', '12,505', 'douze', '1e3'])('refuse « %s »', (input) => {
    expect(eurosToCents(input)).toBeNull();
  });
});

describe('dates locales', () => {
  it("convertit l'heure locale d'un champ datetime-local en ISO UTC, aller et retour", () => {
    const iso = localDateTimeToIso('2026-12-05T19:00')!;
    expect(new Date(iso).getTime()).toBe(new Date(2026, 11, 5, 19, 0).getTime());
    expect(toLocalDateTimeInput(new Date(iso))).toBe('2026-12-05T19:00');
  });

  it('renvoie null pour une valeur vide ou invalide', () => {
    expect(localDateTimeToIso('')).toBeNull();
    expect(localDateTimeToIso('pas une date')).toBeNull();
  });
});

describe('validateEventForm', () => {
  it('accepte un formulaire complet sans image', () => {
    expect(validateEventForm(valid, null, NOW)).toEqual({ fields: {} });
  });

  it('refuse un début à la minute actuelle : il doit être dans le futur', () => {
    const { fields } = validateEventForm({ ...valid, startsAt: '2026-11-24T15:00' }, null, NOW);
    expect(fields.startsAt).toBe('La date de début doit être dans le futur');
  });

  it('refuse les prix mal saisis, négatifs ou trop élevés', () => {
    const priceError = (priceCents: string) =>
      validateEventForm({ ...valid, priceCents }, null, NOW).fields.priceCents;
    expect(priceError('-1')).toBe('Le prix doit être positif ou nul');
    expect(priceError('12,345')).toBe('Le prix doit être un montant en euros, par exemple 12,50');
    expect(priceError('10000,01')).toBe('Le prix ne doit pas dépasser 10 000 €');
    expect(priceError('0')).toBeUndefined();
  });

  it('refuse une capacité non entière ou trop grande', () => {
    const capacityError = (capacity: string) =>
      validateEventForm({ ...valid, capacity }, null, NOW).fields.capacity;
    expect(capacityError('2.5')).toBe('La capacité doit être un nombre entier');
    expect(capacityError('100001')).toBe('La capacité ne doit pas dépasser 100 000 places');
    expect(capacityError('1')).toBeUndefined();
  });
});

describe('validateImage', () => {
  const file = (type: string, size: number) => new File([new Uint8Array(size)], 'image', { type });

  it('accepte un JPG ou un PNG de 2 Mo au plus', () => {
    expect(validateImage(file('image/jpeg', 2 * 1024 * 1024))).toBeUndefined();
    expect(validateImage(file('image/png', 10))).toBeUndefined();
    expect(validateImage(null)).toBeUndefined();
  });

  it('refuse un autre format ou un fichier trop gros', () => {
    expect(validateImage(file('image/webp', 10))).toBe("L'image doit être au format JPG ou PNG");
    expect(validateImage(file('image/png', 2 * 1024 * 1024 + 1))).toBe(
      "L'image ne doit pas dépasser 2 Mo",
    );
  });
});

describe('toCreateEventInput', () => {
  it('nettoie les textes, convertit le prix en centimes et omet les champs facultatifs vides', () => {
    expect(toCreateEventInput(valid)).toEqual({
      title: 'Nuit du jazz',
      description: 'Trois quartets.',
      categoryId: 'cat-concert',
      startsAt: new Date(2026, 11, 5, 19, 0).toISOString(),
      venue: 'Le Transbordeur',
      city: 'Lyon',
      priceCents: 1250,
      capacity: 300,
    });
  });

  it('transmet la fin et l’adresse quand elles sont renseignées', () => {
    const input = toCreateEventInput({
      ...valid,
      endsAt: '2026-12-05T22:00',
      address: ' 3 boulevard de Stalingrad ',
    });
    expect(input.endsAt).toBe(new Date(2026, 11, 5, 22, 0).toISOString());
    expect(input.address).toBe('3 boulevard de Stalingrad');
  });
});
