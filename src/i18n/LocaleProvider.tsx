import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { SUPPORTED_LOCALES } from '../hooks/usePreferredLocale'

type LocaleCode = string

interface LocaleContextValue {
  locale: LocaleCode
  setLocale: (newLocale: LocaleCode) => void
  supportedLocales: typeof SUPPORTED_LOCALES
  getCurrentLocale: () => (typeof SUPPORTED_LOCALES)[number]
  isInitialized: boolean
  formatMessage: (messages: Record<string, string>) => string
}

export const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

const DEFAULT_LOCALE: LocaleCode = 'es-UY'
const LOCALE_STORAGE_KEY = 'preferredLocale'
const LOCALE_COOKIE_KEY = 'preferredLocale'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

function detectBrowserLocale(): string {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const browserLang = navigator.language || navigator.languages?.[0] || DEFAULT_LOCALE
  const exactMatch = SUPPORTED_LOCALES.find(l => l.code === browserLang)
  if (exactMatch) return exactMatch.code
  const langPart = browserLang.split('-')[0]
  const langMatch = SUPPORTED_LOCALES.find(l => l.code.startsWith(langPart))
  if (langMatch) return langMatch.code
  return DEFAULT_LOCALE
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    if (typeof window === 'undefined') return DEFAULT_LOCALE
    const cookieLocale = getCookieValue(LOCALE_COOKIE_KEY)
    if (cookieLocale && SUPPORTED_LOCALES.some(l => l.code === cookieLocale)) {
      return cookieLocale
    }
    const storageLocale = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (storageLocale && SUPPORTED_LOCALES.some(l => l.code === storageLocale)) {
      return storageLocale
    }
    return detectBrowserLocale()
  })
  const [isInitialized, setIsInitialized] = useState(false)

  // Ensure hydration-safe init (idempotent)
  useEffect(() => {
    if (isInitialized) return
    const cookieLocale = getCookieValue(LOCALE_COOKIE_KEY)
    const storageLocale = localStorage.getItem(LOCALE_STORAGE_KEY)
    const browserLocale = detectBrowserLocale()
    const finalLocale = cookieLocale || storageLocale || browserLocale
    if (SUPPORTED_LOCALES.some(l => l.code === finalLocale) && finalLocale !== locale) {
      setLocaleState(finalLocale)
    }
    setIsInitialized(true)
  }, [isInitialized, locale])

  const setLocale = useCallback((newLocale: string) => {
    if (!SUPPORTED_LOCALES.some(l => l.code === newLocale)) {
      console.warn(`Unsupported locale: ${newLocale}`)
      return
    }
    // Persist first to keep SSR and reloads consistent
    setCookie(LOCALE_COOKIE_KEY, newLocale)
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
    setLocaleState(newLocale)
  }, [])

  const getCurrentLocale = useCallback(() => {
    return SUPPORTED_LOCALES.find(l => l.code === locale) || SUPPORTED_LOCALES[0]
  }, [locale])

  const formatMessage = useCallback((messages: Record<string, string>) => {
    return messages[locale] || messages[DEFAULT_LOCALE] || Object.values(messages)[0] || ''
  }, [locale])

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    supportedLocales: SUPPORTED_LOCALES,
    getCurrentLocale,
    isInitialized,
    formatMessage,
  }), [formatMessage, getCurrentLocale, isInitialized, locale, setLocale])

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}
