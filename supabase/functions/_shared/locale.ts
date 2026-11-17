export const SUPPORTED_LOCALES = [
  "en", "fa", "ar", "de", "es", "fr", "ru", "tr", "hi", "zh", "ja", "pt",
] as const;

export function normalizeSupportedLocale(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(normalized) ? normalized : null;
}
