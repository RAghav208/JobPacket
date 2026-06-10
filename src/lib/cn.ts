export type ClassValue = string | number | false | null | undefined;

/** Minimal className combiner — joins truthy values with a space. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
