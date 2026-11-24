# EventHub

Plateforme de gestion d'événements : un visiteur consulte le catalogue, un participant s'inscrit, un organisateur gère ses événements.

| Couche          | Pile                                                                                 |
| --------------- | ------------------------------------------------------------------------------------ |
| Front           | React 19 + TypeScript (SPA Vite), React Router, TanStack Query                       |
| Back            | NestJS 12 + Prisma 7, API REST sous `/api/v1`                                        |
| Base de données | PostgreSQL 17                                                                        |
| Contrat         | `contract/openapi.json`, généré par l'API ; types et mocks MSW du Front en découlent |
| Autres services | Mailpit (e-mails en dev), volume Docker pour les images (à partir du Sprint 3)       |

```text
EventHub-YNOV/
├── apps/
│   ├── api/          NestJS + Prisma (modules auth, events, categories ; registrations à venir)
│   └── web/          SPA React (Liste, Détail, Inscription, Connexion, Mes inscriptions ; mocks MSW dans src/mocks)
├── contract/
│   └── openapi.json  contrat généré par l'API, source des types du Front
├── docker-compose.yml  PostgreSQL + Mailpit
└── .github/workflows/ci.yml
```

## Démarrer

Prérequis : Node 24, pnpm 11 (`corepack enable`), Docker.

```bash
pnpm install                      # installe tout et génère le client Prisma
pnpm db:up                        # lance PostgreSQL (5432) et Mailpit (http://localhost:8025)
cp apps/api/.env.example apps/api/.env
pnpm --filter api db:migrate      # applique les migrations
pnpm --filter api db:seed         # 20 événements de démo, dont des complets, et des comptes de démo
pnpm dev                          # API sur :3000, Front sur :5173
```

- Front : <http://localhost:5173>
- Documentation de l'API (Swagger UI) : <http://localhost:3000/api/docs>

En dev, Vite redirige `/api` vers l'API : le Front et l'API partagent la même origine.

### Comptes de démo

Créés par le seed, tous avec le mot de passe `eventhub-demo` :

| Rôle         | Email                        |
| ------------ | ---------------------------- |
| Participant  | `participant1@eventhub.test` |
| Organisateur | `camille@eventhub.test`      |

Les autres comptes du seed (`participant2` à `participant40`, `yanis@eventhub.test`) utilisent le même mot de passe.

### Front sans API (mocks)

```bash
pnpm --filter web dev:mock
```

Le Front tourne alors sur les handlers MSW de `apps/web/src/mocks`, typés par le contrat : ils reproduisent les filtres, la pagination et les erreurs 404 de l'API, ainsi que l'authentification (inscription, connexion, déconnexion, `/auth/me`) avec les mêmes comptes de démo. La session simulée est gardée dans le `sessionStorage` de l'onglet : elle survit à un rafraîchissement, comme le cookie de l'API.

## Workflow du contrat OpenAPI

Le contrat est la frontière entre Front et Back : une story démarre par son contrat, le Front avance sur mock, puis branche l'API réelle dans le même sprint.

1. Le Back décrit l'endpoint (DTO + décorateurs `@nestjs/swagger`).
2. `pnpm contract` régénère `contract/openapi.json` puis `apps/web/src/api/schema.d.ts`.
3. Le Front écrit ses handlers MSW avec `openapi-msw` : un chemin, un paramètre ou une réponse hors contrat ne compile pas.
4. Les deux fichiers générés sont commités ; la CI échoue s'ils ne correspondent plus au code.

### Format des erreurs

Toutes les erreurs suivent `ApiErrorDto` :

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "La requête contient des champs invalides",
  "details": [{ "field": "pageSize", "message": "pageSize doit être inférieur ou égal à 50" }],
  "path": "/api/v1/events?pageSize=99",
  "timestamp": "2026-11-20T10:33:21.774Z"
}
```

`details` n'est présent que pour les erreurs de validation : les formulaires Réservation et Inscription s'en serviront pour afficher les erreurs champ par champ.

## Endpoints

| Méthode | Chemin                              | Story      | Description                                                                                                                           |
| ------- | ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/api/v1/events`                    | US01, US02 | Catalogue paginé (`page`, `pageSize` ≤ 50), filtres combinables `from`, `to`, `category`, `city`                                      |
| GET     | `/api/v1/events/{id}`               | US03       | Détail : description, organisateur, places restantes ; 404 si inconnu                                                                 |
| GET     | `/api/v1/categories`                | US02       | Catégories pour le filtre                                                                                                             |
| POST    | `/api/v1/auth/sign-up`              | US04       | Création d'un compte participant ; 400 avec `details`, 409 si l'email est pris                                                        |
| POST    | `/api/v1/auth/sign-in`              | US04       | Connexion : pose le cookie de session ; 401 générique si les identifiants sont faux                                                   |
| POST    | `/api/v1/auth/sign-out`             | US04       | Déconnexion : supprime la session en base et efface le cookie ; 204                                                                   |
| GET     | `/api/v1/auth/me`                   | US04       | Utilisateur connecté (id, email, prénom, nom, rôle) ; 401 sans session                                                                |
| POST    | `/api/v1/events/{id}/registrations` | US05       | Inscription de l'utilisateur connecté, en transaction ; 201 avec les places restantes, 401, 404, 409 (déjà inscrit, complet ou passé) |
| GET     | `/api/v1/registrations/me`          | US06, US07 | Mes inscriptions (passées comprises), triées par date d'événement ; 401 sans session                                                  |
| DELETE  | `/api/v1/registrations/{id}`        | US06       | Annulation d'une inscription, la place est libérée ; 204, 401, 403 (pas la mienne), 404, 409 (événement passé)                        |

Sans `from`, le catalogue n'affiche que les événements à venir. Une date seule dans `to` inclut toute la journée.

### Authentification

- Session côté serveur (table `sessions`), portée par le cookie `eventhub_session` : HttpOnly, SameSite=Lax, Secure quand `NODE_ENV=production`, valable 7 jours. La base ne stocke que l'empreinte SHA-256 du jeton.
- Le Front appelle l'API avec `credentials: 'include'` ; hors proxy Vite, le CORS n'autorise que l'origine `FRONT_URL`.
- Mots de passe hachés avec argon2id, 8 caractères minimum. L'email est normalisé (espaces retirés, minuscules).
- Côté API, une route se protège avec `@UseGuards(AuthGuard)` et lit l'utilisateur avec `@CurrentUser()`. Pour la restreindre à un rôle : `@UseGuards(AuthGuard, RolesGuard) @Roles(Role.ORGANIZER)` (403 sinon).

### Inscriptions

- `POST /events/{id}/registrations` verrouille la ligne de l'événement (`SELECT … FOR UPDATE`) dans une transaction : les inscriptions simultanées au même événement passent l'une après l'autre, la capacité n'est jamais dépassée.
- `DELETE /registrations/{id}` supprime l'inscription de son propriétaire uniquement (403 sinon) et refuse les événements passés (409) : les places restantes se déduisent des inscriptions, la place est donc libérée sans autre écriture.
- La contrainte unique `(event_id, user_id)` garantit une seule inscription par utilisateur ; les refus (déjà inscrit, complet, passé) renvoient 409 avec un message distinct.

## Scripts

| Commande                                       | Effet                                                    |
| ---------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                                     | API et Front en mode watch                               |
| `pnpm test`                                    | tests unitaires et de composants (API + Front)           |
| `pnpm --filter api test:e2e`                   | tests d'intégration de l'API sur la base `eventhub_test` |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | qualité                                                  |
| `pnpm contract`                                | régénère le contrat OpenAPI et les types du Front        |
| `pnpm --filter web storybook`                  | Storybook des composants sur :6006                       |
| `pnpm --filter api db:reset`                   | vide la base de dev, rejoue les migrations et le seed    |

Les tests e2e créent la base `eventhub_test` si besoin et refusent de tourner sur une base dont le nom ne finit pas par `_test`, car ils vident les tables.

## CI

`.github/workflows/ci.yml` tourne sur chaque push sur `main` et sur chaque pull request :

- **Format et contrat** : Prettier, puis vérifie que `openapi.json` et `schema.d.ts` sont à jour.
- **API** : lint, typecheck, tests unitaires, tests e2e sur un PostgreSQL de service, build.
- **Front** : lint, typecheck, tests, build, build Storybook.

## Avancement

| Sprint | Stories              | État                            |
| ------ | -------------------- | ------------------------------- |
| 1      | US01, US02, US03     | Livré                           |
| 2      | US04, US05           | Livré                           |
| 3      | US06 à US09          | En cours : US06 et US07 livrées |
| 4      | US10 à US13 (+ US14) | À venir                         |

Le schéma Prisma contient déjà `users` et `registrations` : les places restantes se calculent à partir des inscriptions.
