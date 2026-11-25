# Runbook EventHub

## But et mode d'emploi

Ouvrez ce runbook dès que l'environnement local, les tests ou la CI ne se comportent pas comme prévu.
Cherchez le message exact (`Ctrl+F` sur un code comme `P1001` ou un extrait du message) dans la section [Symptômes](#symptômes).
Chaque entrée donne la cause, les commandes pour la confirmer et celles pour corriger.
Après une panne résolue, ajoutez une entrée avec le [modèle](#format-dune-entrée) : seulement un cas réel, avec sa source.
Le README reste la référence du fonctionnement normal ; ce document ne traite que des pannes.

## Démarrer en local

Les commandes se lancent à la racine du dépôt. Elles sont identiques dans Git Bash et dans PowerShell, sauf mention contraire. Le détail de chaque étape est dans le README, section [Démarrer](../README.md#démarrer).

- [ ] **Prérequis** : Node 24 ou plus (`engines` du `package.json`, `.nvmrc`), pnpm 11.13.1 (`packageManager`), Docker Desktop démarré.

  ```bash
  node --version
  pnpm --version
  docker info
  ```

  Attendu : `v24` ou plus, `11.13.1`, et `docker info` sans erreur. Si pnpm manque ou n'est pas en 11.13.1 :

  ```bash
  npm install -g pnpm@11.13.1
  ```

  Node 25 et plus ne fournit plus `corepack` : voir [Cannot find matching keyid](#cannot-find-matching-keyid-après-corepack-enable) si `corepack enable` a déjà été lancé.

- [ ] **Dépendances** (génère aussi le client Prisma) :

  ```bash
  pnpm install
  ```

- [ ] **Base et Mailpit** :

  ```bash
  pnpm db:up
  ```

  ⚠️ Sous Windows, si un PostgreSQL installé sur la machine occupe déjà le port 5432, voir [P1010 au démarrage de l'API](#p1010--user-was-denied-access-on-the-database) avant d'aller plus loin.

- [ ] **Fichiers `.env`** :

  ```bash
  cp apps/api/.env.example apps/api/.env
  ```

  Côté Front, aucune copie n'est nécessaire : `apps/web/.env.example` documente `VITE_API_URL`, à laisser vide en dev (Vite redirige `/api` et `/uploads` vers l'API), et `apps/web/.env.mock` sert au mode mock.

- [ ] **Migration et seed** :

  ```bash
  pnpm --filter api db:migrate
  pnpm --filter api db:seed
  ```

  Le seed crée 20 événements et les comptes de démo.

- [ ] **Lancer l'API et le Front** :

  ```bash
  pnpm dev
  ```

- [ ] **Front seul, sans API** (mocks MSW, pas besoin de Docker) :

  ```bash
  pnpm --filter web dev:mock
  ```

  Voir le README, section [Front sans API (mocks)](../README.md#front-sans-api-mocks).

### URL, ports et comptes

| Service               | Adresse                          | Remarque                                                 |
| --------------------- | -------------------------------- | -------------------------------------------------------- |
| Front (Vite)          | <http://localhost:5173>          | `pnpm dev` ou `pnpm --filter web dev:mock`               |
| API                   | <http://localhost:3000/api/v1>   | `PORT` dans `apps/api/.env`                              |
| Swagger UI            | <http://localhost:3000/api/docs> | contrat OpenAPI en direct                                |
| Images des événements | <http://localhost:3000/uploads/> | dossier `UPLOADS_DIR`, aussi servi par Vite              |
| Mailpit (interface)   | <http://localhost:8025>          | e-mails envoyés par l'API                                |
| Mailpit (SMTP)        | `localhost:1025`                 |                                                          |
| PostgreSQL            | `localhost:5432`                 | ou `POSTGRES_PORT` ; bases `eventhub` et `eventhub_test` |
| Storybook             | <http://localhost:6006>          | `pnpm --filter web storybook`                            |

Comptes de démo, tous avec le mot de passe `eventhub-demo` : `camille@eventhub.test` (organisateur), `participant1@eventhub.test` (participant). Voir le README, section [Comptes de démo](../README.md#comptes-de-démo).

### Vérification rapide

Avec `pnpm dev` lancé, cette requête traverse le Front, son proxy, l'API et la base :

```bash
curl -s "http://localhost:5173/api/v1/events?pageSize=1"
```

Attendu : un JSON qui se termine par `"meta":{"page":1,"pageSize":1,"total":20,"totalPages":20}` juste après le seed. Dans Windows PowerShell 5.1, tapez `curl.exe` au lieu de `curl`, qui y désigne une autre commande.

## Format d'une entrée

Copiez ce modèle dans le bon groupe de la section [Symptômes](#symptômes). Le titre reprend le message exact, pour que `Ctrl+F` le trouve.

```markdown
#### <message ou comportement exact>

- **Symptôme** : ce que l'on voit, mot pour mot (message, code, étape de CI, écran).
- **Cause** : pourquoi cela arrive.
- **Diagnostic** : commandes qui confirment la cause.
- **Correction** : commandes qui règlent le problème.
- **Prévention** : ce qui évite que cela revienne.
- **Source** : commit, PR, run de CI ou « reproduit en local le AAAA-MM-JJ ».
- **Date** : AAAA-MM-JJ
- **Auteur** : Prénom Nom
```

## Symptômes

### CI et tests

#### CI : « openapi.json ou schema.d.ts n'est pas à jour »

- **Symptôme** : le job « Format et contrat OpenAPI » échoue à l'étape « Le contrat et les types du Front sont à jour », avec l'annotation `openapi.json ou schema.d.ts n'est pas à jour : lancez 'pnpm contract' et commitez le résultat.`
- **Cause** : un DTO ou un décorateur `@nestjs/swagger` a changé côté API, mais `contract/openapi.json` et `apps/web/src/api/schema.d.ts` n'ont pas été régénérés et commités. La CI relance `pnpm contract` et refuse toute différence. Voir le README, section [Workflow du contrat OpenAPI](../README.md#workflow-du-contrat-openapi).
- **Diagnostic** : les mêmes commandes que la CI. `exit=1` et la liste des fichiers confirment la cause.

  ```bash
  pnpm contract
  git diff --exit-code --stat -- contract/openapi.json apps/web/src/api/schema.d.ts; echo "exit=$?"
  ```

  Dans PowerShell, remplacez `echo "exit=$?"` par `echo "exit=$LASTEXITCODE"`. Sous Windows, Git peut afficher `LF will be replaced by CRLF` : ce n'est qu'un avertissement.

- **Correction** :

  ```bash
  pnpm contract
  git add contract/openapi.json apps/web/src/api/schema.d.ts
  git commit -m "chore(contract): contrat et types du Front régénérés"
  ```

- **Prévention** : lancer `pnpm contract` dans le même commit que toute modification d'un DTO, d'un contrôleur ou d'un exemple du contrat, puis relancer le diagnostic avant de pousser.
- **Source** : runs de CI [45355041654](https://github.com/EliottSICOT/EventHub-YNOV/actions/runs/45355041654) (branche `sprint-2/us05-inscription-front`, commit `10f037a`) et [45371732692](https://github.com/EliottSICOT/EventHub-YNOV/actions/runs/45371732692) (branche `sprint-3/us06-annulation-front`, commit `120ee28`). Diagnostic retesté en local le 2026-11-25.
- **Date** : 2026-11-24
- **Auteur** : Eliott Sicot

#### Un test Front passe en local mais échoue en CI après une fusion de `main`

- **Symptôme** : le job « Front (React) » échoue à l'étape `pnpm test`, avec `Error: expect(element).toBeInTheDocument()` et `element could not be found in the document` sur `src/features/registrations/MyRegistrationsPage.test.tsx:254`. Le même test passait avant la fusion de `main` dans la branche.
- **Cause** : le test atteignait l'état voulu en rejouant à l'écran tout un parcours (déconnexion, lien « Connexion », formulaire de connexion). Après la fusion de `main` (commit `48edf1c`), ce parcours ne menait plus à l'élément attendu. Un test qui dépend de redirections étrangères à ce qu'il vérifie casse dès qu'elles changent.
- **Diagnostic** : rejouer le fichier en échec sur la branche à jour de `main`.

  ```bash
  git fetch origin
  git merge origin/main
  pnpm --filter web test src/features/registrations/MyRegistrationsPage.test.tsx
  ```

- **Correction** : préparer l'état directement (session simulée, cache de requêtes) au lieu de rejouer la navigation, comme dans le commit `c31dfb3` : `mockAuth.signIn(...)` puis `queryClient.setQueryData(meQueryKey, ...)`.
- **Prévention** : dans un test de composant, ne parcourir à l'écran que le comportement testé. Avant de pousser une branche qui a fusionné `main`, relancer `pnpm --filter web test`.
- **Source** : run de CI [45372626108](https://github.com/EliottSICOT/EventHub-YNOV/actions/runs/45372626108) (branche `sprint-3/us07-mes-inscriptions`, commit `48edf1c`), corrigé par le commit `c31dfb3` (run suivant en succès).
- **Date** : 2026-11-24
- **Auteur** : Eliott Sicot

### Installation et base de données

#### Cannot find matching keyid après corepack enable

- **Symptôme** : après `corepack enable`, `pnpm --version` (ou toute commande `pnpm`) s'arrête sur `Error: Cannot find matching keyid: {"signatures":[...],"keys":[...]}`. La pile d'appel cite `corepack.cjs` dans le dossier d'un Node plus ancien que celui de `node --version`.
- **Cause** : Node 25 et plus ne fournit plus `corepack`. Si un ancien Node (ici un Node 22.13.1 installé par scoop) reste dans le `PATH`, c'est son `corepack` qui s'exécute. Il crée des raccourcis `pnpm` qui passent avant le pnpm déjà installé, et il est trop ancien pour vérifier la signature actuelle de pnpm.
- **Diagnostic** : dans Git Bash, la première ligne de chaque commande indique celle qui s'exécute.

  ```bash
  node --version
  which -a node corepack pnpm
  ```

  La cause est confirmée si `corepack` et le premier `pnpm` ne sont pas dans le dossier du `node` affiché en premier. Dans PowerShell : `Get-Command -All node, corepack, pnpm`.

- **Correction** : retirer les raccourcis avec le même `corepack`, puis installer pnpm avec npm.

  ```bash
  corepack disable
  npm install -g pnpm@11.13.1
  pnpm --version
  ```

  Attendu : `11.13.1`.

- **Prévention** : installer pnpm avec `npm install -g pnpm@11.13.1` (voir [Démarrer en local](#démarrer-en-local)) et retirer du `PATH` les anciennes installations de Node.
- **Source** : reproduit en local le 2026-11-25 en suivant la section « Démarrer en local » depuis un clone propre (Node 26.13.0 dans `C:\Program Files\nodejs`, Node 22.13.1 de scoop dans le `PATH`).
- **Date** : 2026-11-25
- **Auteur** : Eliott Sicot

#### P1010 : User was denied access on the database

- **Symptôme** : `pnpm --filter api db:migrate` (ou `pnpm --filter api test:e2e`) s'arrête sur `Error: P1010: User was denied access on the database (not available)`, alors que `pnpm db:up` a démarré le conteneur PostgreSQL sans erreur.
- **Cause** : un PostgreSQL installé sur Windows (service `postgresql-x64-17`) écoute déjà sur le port 5432. Docker publie quand même le conteneur sur 5432, mais `localhost:5432` aboutit au PostgreSQL de Windows, qui ne connaît pas l'utilisateur `eventhub`.
- **Diagnostic** (PowerShell ou cmd) : un processus `postgres.exe` qui n'est pas Docker confirme la cause.

  ```powershell
  netstat -ano | findstr ":5432 "
  Get-Service postgresql*
  ```

  `tasklist /FI "PID eq <pid>"` donne le nom du processus d'un PID affiché par `netstat`.

- **Correction** : publier le conteneur sur 5433. Le fichier `.env` à la racine (ignoré par Git) est lu par `docker compose`, donc le port reste le même à chaque `pnpm db:up`.

  ```bash
  docker compose down
  node -e "require('fs').writeFileSync('.env', 'POSTGRES_PORT=5433\n')"
  pnpm db:up
  ```

  Puis faire pointer l'API sur 5433 (même commande dans Git Bash et PowerShell, sans toucher à l'encodage du fichier) :

  ```bash
  node -e "const fs = require('fs'); const f = 'apps/api/.env'; fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('localhost:5432', 'localhost:5433'))"
  ```

  Les tests e2e visent 5432 par défaut : lancez-les avec `TEST_DATABASE_URL`. Dans Git Bash :

  ```bash
  TEST_DATABASE_URL="postgresql://eventhub:eventhub@localhost:5433/eventhub_test?schema=public" pnpm --filter api test:e2e
  ```

  Dans PowerShell :

  ```powershell
  $env:TEST_DATABASE_URL = 'postgresql://eventhub:eventhub@localhost:5433/eventhub_test?schema=public'; pnpm --filter api test:e2e
  ```

- **Prévention** : vérifier le port 5432 avant `pnpm db:up` sur une nouvelle machine, et garder `POSTGRES_PORT` dans le `.env` racine.
- **Source** : reproduit en local le 2026-11-25 depuis un clone propre, en suivant « Démarrer en local » à la lettre. La variable `POSTGRES_PORT` de `docker-compose.yml` existe depuis le commit `0af97a3`.
- **Date** : 2026-11-25
- **Auteur** : Eliott Sicot

#### P1001 : Can't reach database server

- **Symptôme** : `pnpm --filter api test:e2e` s'arrête avant le premier test, sur `Error: P1001: Can't reach database server at localhost:5433` (ou `5432`), puis `Error: Command failed: prisma migrate deploy` et `No test files found, exiting with code 1`. La même erreur `P1001` apparaît au démarrage de l'API.
- **Cause** : le conteneur PostgreSQL ne tourne pas, en général parce que Docker Desktop n'est pas démarré (après un redémarrage du poste, par exemple). Une base « non migrée » n'est pas en cause : la mise en place des e2e (`apps/api/test/global-setup.ts`) applique elle-même les migrations sur `eventhub_test`.
- **Diagnostic** :

  ```bash
  docker info
  docker compose ps
  ```

  `docker info` en erreur (`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.`) ou un `docker compose ps` sans conteneur `postgres` confirme la cause.

- **Correction** : démarrer Docker Desktop, puis :

  ```bash
  pnpm db:up
  docker compose ps
  pnpm --filter api test:e2e
  ```

  Attendu : le conteneur `postgres` en `healthy`, puis les e2e passent. Si la base tourne sur un autre port que 5432, ajoutez `TEST_DATABASE_URL` (voir l'entrée [P1010](#p1010--user-was-denied-access-on-the-database)).

- **Prévention** : lancer `docker compose ps` avant les e2e, et activer le démarrage de Docker Desktop avec la session Windows.
- **Source** : reproduit en local le 2026-11-25 (Docker Desktop arrêté après un redémarrage du poste).
- **Date** : 2026-11-25
- **Auteur** : Eliott Sicot

#### Cannot find module '../generated/prisma/client.js'

- **Symptôme** : `pnpm --filter api typecheck`, `pnpm dev` ou `pnpm --filter api start` affichent `error TS2307: Cannot find module '../generated/prisma/client.js' or its corresponding type declarations.`, puis des erreurs en cascade comme `Property 'user' does not exist on type 'PrismaService'`.
- **Cause** : le client Prisma n'est pas versionné (`apps/api/src/generated/` est dans `.gitignore`). Il est généré par le `postinstall` de `pnpm install`. Il manque si ce `postinstall` n'a pas tourné ou si le dossier a été supprimé.
- **Diagnostic** :

  ```bash
  ls apps/api/src/generated/prisma
  ```

  `No such file or directory` confirme la cause.

- **Correction** :

  ```bash
  pnpm --filter api prisma:generate
  pnpm --filter api typecheck
  ```

  Attendu : `Generated Prisma Client`, puis un typecheck sans erreur.

- **Prévention** : relancer `pnpm install` après chaque `git pull` qui touche `pnpm-lock.yaml` ou `apps/api/prisma/schema.prisma`.
- **Source** : reproduit en local le 2026-11-25 dans un clone propre, en supprimant `apps/api/src/generated`.
- **Date** : 2026-11-25
- **Auteur** : Eliott Sicot

## Rituel

| Moment                     | Action                         | Responsable                             |
| -------------------------- | ------------------------------ | --------------------------------------- |
| Après chaque panne résolue | Ajouter l'entrée du symptôme   | Celui qui a dépanné                     |
| Après chaque post-mortem   | Transformer l'action en entrée | Scrum Master                            |
| Fin de sprint              | Relire et tester une entrée    | Une personne Front et une personne Back |

## Historique des relectures

| Date | Entrée testée | Testeur | Résultat |
| ---- | ------------- | ------- | -------- |
|      |               |         |          |
