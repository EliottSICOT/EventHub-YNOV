import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { flattenValidationErrors } from '../../common/errors/validation.exception.js';
import { CreateEventDto } from './create-event.dto.js';

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const valid = {
  title: 'Nuit du jazz',
  description: 'Trois quartets sur scène.',
  categoryId: 'cat-1',
  startsAt: inDays(10),
  venue: 'Le Transbordeur',
  city: 'Lyon',
  capacity: 300,
  priceCents: 1500,
};

/** Valide comme le `ValidationPipe` global et renvoie les erreurs au format `details`. */
async function errorsOf(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateEventDto, body);
  return flattenValidationErrors(await validate(dto, { whitelist: true }));
}

const fields = (errors: { field: string }[]) => errors.map((e) => e.field).sort();

describe('CreateEventDto', () => {
  it('accepte un événement complet, sans fin ni adresse', async () => {
    expect(await errorsOf(valid)).toEqual([]);
  });

  it('accepte un événement gratuit avec une fin postérieure au début', async () => {
    expect(
      await errorsOf({ ...valid, priceCents: 0, endsAt: inDays(11), address: '3 bd Stalingrad' }),
    ).toEqual([]);
  });

  it('exige les champs obligatoires, avec des messages en français', async () => {
    const errors = await errorsOf({});
    expect(fields(errors)).toEqual(
      expect.arrayContaining([
        'capacity',
        'categoryId',
        'city',
        'description',
        'priceCents',
        'startsAt',
        'title',
        'venue',
      ]),
    );
    expect(errors).toContainEqual({ field: 'title', message: 'Le titre est obligatoire' });
    expect(errors).toContainEqual({ field: 'venue', message: 'Le lieu est obligatoire' });
  });

  it('refuse un titre de moins de 3 ou de plus de 120 caractères', async () => {
    expect(await errorsOf({ ...valid, title: '  ab ' })).toEqual([
      { field: 'title', message: 'Le titre doit contenir au moins 3 caractères' },
    ]);
    expect(await errorsOf({ ...valid, title: 'x'.repeat(121) })).toEqual([
      { field: 'title', message: 'Le titre ne doit pas dépasser 120 caractères' },
    ]);
  });

  it('refuse une description de plus de 5 000 caractères', async () => {
    expect(await errorsOf({ ...valid, description: 'x'.repeat(5001) })).toEqual([
      { field: 'description', message: 'La description ne doit pas dépasser 5000 caractères' },
    ]);
  });

  it('refuse une date de début passée', async () => {
    expect(await errorsOf({ ...valid, startsAt: inDays(-1) })).toEqual([
      { field: 'startsAt', message: 'La date de début doit être dans le futur' },
    ]);
  });

  it('refuse une date de fin antérieure ou égale au début', async () => {
    expect(await errorsOf({ ...valid, endsAt: valid.startsAt })).toEqual([
      { field: 'endsAt', message: 'La date de fin doit être postérieure à la date de début' },
    ]);
  });

  it('refuse une capacité inférieure à 1 ou non entière', async () => {
    expect(await errorsOf({ ...valid, capacity: 0 })).toEqual([
      { field: 'capacity', message: "La capacité doit être d'au moins 1 place" },
    ]);
    expect(fields(await errorsOf({ ...valid, capacity: 2.5 }))).toEqual(['capacity']);
  });

  it('refuse un prix négatif ou non entier', async () => {
    expect(await errorsOf({ ...valid, priceCents: -1 })).toEqual([
      { field: 'priceCents', message: 'Le prix doit être positif ou nul' },
    ]);
    expect(fields(await errorsOf({ ...valid, priceCents: 12.5 }))).toEqual(['priceCents']);
  });

  it('traite une adresse vide comme absente', async () => {
    const dto = plainToInstance(CreateEventDto, { ...valid, address: '   ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.address).toBeUndefined();
  });
});
