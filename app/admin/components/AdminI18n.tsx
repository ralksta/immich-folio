'use client';

/**
 * Carries the admin panel's locale to its components (#604).
 *
 * The admin layout resolves the locale on the server (`adminLang`, else the
 * site's `lang`) and passes only that string — dictionaries hold functions and
 * would not serialise. Outside the provider, as in most component tests, the
 * panel is English.
 */

import { createContext, Fragment, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { getAdminDictionary, type AdminDictionary } from '@/lib/i18n/admin';

const AdminLocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function AdminI18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <AdminLocaleContext.Provider value={locale}>{children}</AdminLocaleContext.Provider>;
}

/** The panel's resolved locale — `DEFAULT_LOCALE` outside a provider. */
export function useAdminLocale(): Locale {
  return useContext(AdminLocaleContext);
}

/** The panel's dictionary for the current locale. */
export function useAdminDictionary(): AdminDictionary {
  const locale = useAdminLocale();
  return useMemo(() => getAdminDictionary(locale), [locale]);
}

/**
 * Fill `{name}` placeholders in a dictionary string with React nodes — a
 * `<code>` element, a link — so a translation decides where the markup sits.
 * A placeholder without a part is left as written, which shows up in review
 * rather than vanishing.
 */
export function rich(template: string, parts: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    const node = name !== undefined && name in parts ? parts[name] : piece;
    return <Fragment key={i}>{node}</Fragment>;
  });
}
