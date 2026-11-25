-- Recherche plein texte du catalogue (US10), sans tenir compte des majuscules ni des accents.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- « simple » : pas de mots vides ni de racines, les mots saisis sont cherchés tels quels.
CREATE TEXT SEARCH CONFIGURATION eventhub_search (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION eventhub_search
  ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part, numword, numhword, hword_numpart
  WITH unaccent, simple;

-- Même expression que dans events.search.ts, sinon l'index n'est pas utilisé.
-- translate : « Node.js » ou « rendez-vous » sont découpés en mots, comme la saisie.
CREATE INDEX "events_search_idx" ON "events" USING GIN (
  to_tsvector('public.eventhub_search'::regconfig, translate("title" || ' ' || "description", './:@_-', '      '))
);
