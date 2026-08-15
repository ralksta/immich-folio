'use client';

/**
 * Carries the resolved locale to client components.
 *
 * Only the locale string crosses the server/client boundary — dictionaries
 * contain functions and would not serialise, so `useDictionary()` looks the
 * object up on the client instead of receiving it as a prop.
 */

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, getDictionary, type Dictionary, type Locale } from '@/lib/i18n';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Resolved locale — `DEFAULT_LOCALE` outside a provider. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Dictionary for the current locale. */
export function useDictionary(): Dictionary {
  const locale = useLocale();
  return useMemo(() => getDictionary(locale), [locale]);
}
