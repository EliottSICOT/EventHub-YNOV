/** Email normalisé : sans espaces autour et en minuscules. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Variante pour `@Transform` de class-transformer. */
export const normalizeEmailTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeEmail(value) : value;
