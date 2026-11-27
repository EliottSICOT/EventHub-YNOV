import { buttonVariants, type ButtonVariants } from '@heroui/react';

/**
 * Classes partagées de l'interface (HeroUI v3 + Tailwind).
 * Un lien de navigation reste un `<a>` (Link de React Router) : on lui donne seulement
 * l'apparence d'un bouton HeroUI, sans changer son rôle pour les lecteurs d'écran.
 */
export function linkButton(
  variant: ButtonVariants['variant'] = 'primary',
  size: ButtonVariants['size'] = 'md',
) {
  return buttonVariants({ variant, size });
}

/** Lien dans un texte : souligné en permanence, pas seulement par la couleur (1.4.1). */
export const textLink =
  'link font-medium text-accent-soft-foreground underline underline-offset-4 decoration-1';

/** Champ natif (input, select, textarea) à l'apparence des champs HeroUI. */
export const fieldInput = 'input w-full';
export const fieldTextArea = 'textarea w-full';
export const fieldLabel = 'label text-sm font-semibold text-foreground';
export const fieldHint = 'description text-sm text-muted';
export const fieldError = 'field-error text-sm font-medium text-danger-soft-foreground';

/** Conteneur de page et titres. */
/** Titre de page en dégradé (contraste vérifié aux deux extrémités, repli en contraste élevé). */
export const pageTitle = 'text-gradient text-3xl font-extrabold tracking-tight sm:text-4xl pb-1';
export const pageSubtitle = 'mt-1 text-muted';
export const sectionTitle = 'text-lg font-bold text-foreground';

/** Listes de lignes (inscriptions, listes d'attente, événements de l'organisateur). */
export const listSection = 'flex flex-col gap-3';
export const listRows = 'flex flex-col gap-3';
export const listRow =
  'glass flex flex-col gap-4 rounded-2xl bg-surface p-5 sm:flex-row sm:items-center sm:justify-between';
export const listRowTitle = 'text-base font-bold text-foreground';
export const listRowMeta = 'text-sm text-muted';
export const listRowSide = 'flex flex-wrap items-center gap-2 sm:justify-end';
