import { useContext } from 'react'
import { LocaleContext } from '../i18n/LocaleProvider'

export interface Locale {
  code: string
  flag: string // textual fallback (code)
  label: string
  nativeName: string
  Icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

import React from 'react'
import { FlagUY, FlagUS, FlagFR, FlagBR, FlagDE, FlagES } from '@/components/icons/flags'

export const SUPPORTED_LOCALES: Locale[] = [
  { code: 'es-UY', flag: 'ES', label: 'Español', nativeName: 'Español', Icon: FlagES },
  { code: 'en',   flag: 'EN', label: 'English', nativeName: 'English', Icon: FlagUS },
  { code: 'fr',   flag: 'FR', label: 'Français', nativeName: 'Français', Icon: FlagFR },
  { code: 'pt-BR',flag: 'BR', label: 'Português', nativeName: 'Português (BR)', Icon: FlagBR },
  { code: 'de',   flag: 'DE', label: 'Deutsch', nativeName: 'Deutsch', Icon: FlagDE }
]

const DEFAULT_LOCALE = 'es-UY'
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
  
  // Match exact locale first
  const exactMatch = SUPPORTED_LOCALES.find(locale => locale.code === browserLang)
  if (exactMatch) return exactMatch.code
  
  // Match language part
  const langPart = browserLang.split('-')[0]
  const langMatch = SUPPORTED_LOCALES.find(locale => locale.code.startsWith(langPart))
  if (langMatch) return langMatch.code
  
  return DEFAULT_LOCALE
}

export function usePreferredLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('usePreferredLocale must be used within LocaleProvider')
  }
  return ctx
}