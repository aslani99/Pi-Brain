import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const supportedLocales = [
  "en", "fa", "ar", "de", "es", "fr", "ru", "tr", "hi", "zh", "ja", "pt",
] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const localeOptions: ReadonlyArray<readonly [SupportedLocale, string]> = [
  ["en", "English"],
  ["fa", "فارسی"],
  ["ar", "العربية"],
  ["de", "Deutsch"],
  ["es", "Español"],
  ["fr", "Français"],
  ["ru", "Русский"],
  ["tr", "Türkçe"],
  ["hi", "हिन्दी"],
  ["zh", "中文"],
  ["ja", "日本語"],
  ["pt", "Português"],
];

const localeLoaders: Record<SupportedLocale, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import("./locales/en"),
  fa: () => import("./locales/fa"),
  ar: () => import("./locales/ar"),
  de: () => import("./locales/de"),
  es: () => import("./locales/es"),
  fr: () => import("./locales/fr"),
  ru: () => import("./locales/ru"),
  tr: () => import("./locales/tr"),
  hi: () => import("./locales/hi"),
  zh: () => import("./locales/zh"),
  ja: () => import("./locales/ja"),
  pt: () => import("./locales/pt"),
};

const loadedLocales = new Set<SupportedLocale>();
const initialization = i18n.use(initReactI18next).init({
  lng: "en",
  resources: {},
  supportedLngs: [...supportedLocales],
  fallbackLng: "en",
  defaultNS: "translation",
  load: "languageOnly",
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
});

export function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  const candidate = (locale ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return supportedLocales.includes(candidate as SupportedLocale)
    ? candidate as SupportedLocale
    : "en";
}

export function localeDirection(locale: string): "rtl" | "ltr" {
  return normalizeLocale(locale) === "fa" || normalizeLocale(locale) === "ar" ? "rtl" : "ltr";
}

function readCachedLocale(): SupportedLocale {
  try {
    const raw = window.localStorage.getItem("pi-brain-preferences-v1");
    if (raw) {
      const parsed = JSON.parse(raw) as { language?: unknown };
      if (typeof parsed.language === "string") return normalizeLocale(parsed.language);
    }
  } catch {
    // Local preferences are an optional startup cache.
  }
  if (typeof navigator !== "undefined") {
    const browserLocales = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const candidate of browserLocales) {
      const base = candidate.trim().toLowerCase().split(/[-_]/)[0];
      if (supportedLocales.includes(base as SupportedLocale)) return base as SupportedLocale;
    }
  }
  return "en";
}

async function loadLocale(locale: SupportedLocale): Promise<void> {
  if (loadedLocales.has(locale)) return;
  const module = await localeLoaders[locale]();
  i18n.addResourceBundle(locale, "translation", module.default, true, true);
  loadedLocales.add(locale);
}

function applyDocumentLocale(locale: SupportedLocale): void {
  const title = i18n.getResource(locale, "translation", "documentTitle")
    ?? i18n.getResource("en", "translation", "documentTitle")
    ?? "BrainQuiz";
  const description = i18n.getResource(locale, "translation", "documentDescription")
    ?? i18n.getResource("en", "translation", "documentDescription")
    ?? "BrainQuiz";
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDirection(locale);
  document.title = String(title);
  const metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (metaDescription) metaDescription.content = String(description);
}

export async function initializeLocale(): Promise<SupportedLocale> {
  await initialization;
  const initialLocale = readCachedLocale();
  await loadLocale("en");
  if (initialLocale !== "en") await loadLocale(initialLocale);
  await i18n.changeLanguage(initialLocale);
  applyDocumentLocale(initialLocale);
  return initialLocale;
}

export async function applyLocale(locale: string): Promise<SupportedLocale> {
  await initialization;
  const normalized = normalizeLocale(locale);
  await loadLocale("en");
  if (normalized !== "en") await loadLocale(normalized);
  await i18n.changeLanguage(normalized);
  applyDocumentLocale(normalized);
  return normalized;
}

export default i18n;
