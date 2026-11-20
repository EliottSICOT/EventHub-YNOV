/** Nom du cookie HttpOnly qui porte le jeton de session. */
export const SESSION_COOKIE = 'eventhub_session';

/** Durée de vie d'une session : 7 jours. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const AUTH_MESSAGES = {
  emailTaken: 'Un compte existe déjà avec cet email',
  invalidCredentials: 'Email ou mot de passe incorrect',
  unauthenticated: 'Authentification requise',
  forbidden: "Vous n'avez pas les droits nécessaires pour cette action",
} as const;
