import { ApiError } from '../../api/client';
import { errorsFromApi, safeRedirect, SIGN_UP_FIELDS, validateSignUp } from './validation';

describe('validateSignUp', () => {
  it('accepte une saisie valide', () => {
    expect(
      validateSignUp({
        lastName: 'Dupont',
        firstName: 'Léa',
        email: ' lea@example.com ',
        password: '12345678',
      }).fields,
    ).toEqual({});
  });

  it('refuse un email mal formé et des noms vides', () => {
    expect(
      validateSignUp({ lastName: ' ', firstName: '', email: 'lea@', password: '12345678' }).fields,
    ).toEqual({
      lastName: 'Le nom est obligatoire',
      firstName: 'Le prénom est obligatoire',
      email: "L'email n'est pas valide",
    });
  });
});

describe('errorsFromApi', () => {
  const error400 = new ApiError(400, {
    statusCode: 400,
    error: 'Bad Request',
    message: 'La requête contient des champs invalides',
    details: [
      { field: 'email', message: 'Email invalide' },
      { field: 'email', message: 'Second message ignoré' },
      { field: 'role', message: 'Champ inconnu' },
    ],
    path: '/api/v1/auth/sign-up',
    timestamp: '',
  });

  it('place les details sous leur champ et regroupe les autres', () => {
    expect(errorsFromApi(error400, SIGN_UP_FIELDS)).toEqual({
      fields: { email: 'Email invalide' },
      form: 'Champ inconnu',
    });
  });

  it("affiche le message de l'API pour une erreur sans details", () => {
    const error = new ApiError(401, {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Email ou mot de passe incorrect',
      path: '',
      timestamp: '',
    });
    expect(errorsFromApi(error, SIGN_UP_FIELDS)).toEqual({
      fields: {},
      form: 'Email ou mot de passe incorrect',
    });
  });

  it('traduit une erreur réseau en message général', () => {
    expect(errorsFromApi(new TypeError('Failed to fetch'), SIGN_UP_FIELDS).form).toMatch(
      /Impossible de contacter le serveur/,
    );
  });
});

describe('safeRedirect', () => {
  it.each([
    ['/events?city=Lyon', '/events?city=Lyon'],
    [null, '/events'],
    ['', '/events'],
    ['https://exemple.com', '/events'],
    ['//exemple.com', '/events'],
    ['/\\exemple.com', '/events'],
    ['javascript:alert(1)', '/events'],
  ])('%s → %s', (target, expected) => {
    expect(safeRedirect(target)).toBe(expected);
  });
});
