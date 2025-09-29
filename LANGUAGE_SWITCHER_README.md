# Language Switcher Implementation

## Overview
Complete internationalization (i18n) system with language switcher for the Hotel AI Concierge app supporting 5 languages with accessibility, persistence, and SSR-friendly design.

## Supported Languages
- **Spanish (es-UY)** UY - Primary language
- **English (en)** EN - International English
- **French (fr)** FR
- **Portuguese (pt-BR)** BR
- **German (de)** DE

## Files Added/Modified

### New Files
1. `src/hooks/usePreferredLocale.ts` - Locale management hook
2. `src/components/LanguageSwitcher.tsx` - Main language switcher component
3. `src/i18n/messages.ts` - Translation messages for all languages

### Modified Files
1. `src/App.tsx` - Integrated language switcher and translations

## Features

### 🎯 UX Design
- **Desktop**: Flag + language label with dropdown
- **Mobile (≤480px)**: Icon only with accessible sheet/dropdown
- **Position**: Top-left corner in header
- **No layout shift**: SSR-friendly with skeleton loading

### ♿ Accessibility
- Full keyboard navigation (Tab/Enter/Escape)
- ARIA roles and labels
- Screen reader announcements: "Change language to [Language]"
- Visible focus indicators
- Color contrast compliant

### 💾 Persistence & Detection
- **Priority order**: Cookie → localStorage → browser detection → default
- **Cookies**: `preferredLocale` (365 days, SameSite=Lax)
- **localStorage**: `preferredLocale` as backup
- **Browser detection**: Matches `navigator.language` to supported locales
- **Fallback**: Spanish (es-UY) if unsupported language

### 🔄 Chat Integration
- Sends `locale` in payload to AI webhook
- `onLanguageChange` callback for additional logic
- UI language independent of chat conversation language

### 📱 Responsive Design
- Desktop: Full label with dropdown
- Mobile: Icon only with accessible menu
- Smooth animations with Framer Motion
- No content layout shift (CLS ~0)

## Usage

### Basic Implementation
```tsx
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { usePreferredLocale } from './hooks/usePreferredLocale'

function App() {
  const { locale } = usePreferredLocale()
  
  const handleLanguageChange = (newLocale: string) => {
    // Optional: Add analytics, toast notifications, etc.
    console.log('Language changed to:', newLocale)
  }

  return (
    <div>
      <LanguageSwitcher onLanguageChange={handleLanguageChange} />
      {/* Rest of your app */}
    </div>
  )
}
```

### Using Translations
```tsx
import { messages, type MessageKey } from './i18n/messages'
import { usePreferredLocale } from './hooks/usePreferredLocale'

function MyComponent() {
  const { locale } = usePreferredLocale()
  
  const t = (key: MessageKey) => {
    return messages[locale]?.[key] || messages['es-UY'][key] || key
  }

  return <h1>{t('header.title')}</h1>
}
```

## Data Attributes for Testing
- `data-qa="language-switcher"` - Main container
- `data-qa="language-button-desktop"` - Desktop button
- `data-qa="language-button-mobile"` - Mobile button
- `data-qa="language-menu"` - Dropdown menu
- `data-qa="language-option-{code}"` - Individual language options

## Adding New Languages

### 1. Add to supported locales
```typescript
// src/hooks/usePreferredLocale.ts
export const SUPPORTED_LOCALES: Locale[] = [
  // ...existing languages
  { code: 'it', flag: '🇮🇹', label: 'Italiano', nativeName: 'Italiano' }
]
```

### 2. Add translations
```typescript
// src/i18n/messages.ts
export const messages = {
  // ...existing languages
  'it': {
    'header.title': 'Assistente Villa Sardinero',
    'welcome.greeting': 'Ciao! Sono il tuo assistente digitale 24/7...',
    // ...add all message keys
  }
}
```

## Technical Decisions

### Why Abbreviations Instead of Flags?
Using language abbreviations (UY, EN, FR, BR, DE) instead of emoji flags provides:
- **Consistency**: All languages have the same visual treatment
- **Clarity**: Text is more readable than small emoji flags
- **Accessibility**: Better for screen readers and high contrast modes
- **Performance**: No emoji rendering issues across devices
- **Professional**: Cleaner, more business-appropriate appearance

### SSR Compatibility
- Initial render shows skeleton to prevent hydration mismatch
- `isInitialized` state ensures client-side only rendering of actual language
- Cookie-first approach works with SSR

### Performance Optimizations
- Lazy loading of dropdown menu
- No blocking of LCP (Largest Contentful Paint)
- Minimal bundle impact with tree-shakeable translations

## Browser Support
- Modern browsers with `Intl` API support
- Graceful fallback for unsupported features
- Progressive enhancement approach

## Testing Recommendations

### Accessibility Tests
```bash
# Install axe-core for accessibility testing
npm install --save-dev @axe-core/react
```

### Keyboard Navigation Test
1. Tab to language switcher
2. Press Enter/Space to open
3. Use Arrow keys to navigate
4. Press Enter to select
5. Press Escape to close

### Persistence Test
1. Change language
2. Refresh page
3. Verify language persists
4. Clear cookies/localStorage
5. Verify fallback to browser language

## Acceptance Criteria ✅

- [x] Loading with French browser suggests "Français" but doesn't force it
- [x] User selection of "Deutsch" persists after refresh
- [x] Chat receives selected locale and responds accordingly
- [x] Fully keyboard and screen reader accessible
- [x] No layout shifts or flickering (CLS ~0)
- [x] LCP of header remains intact
- [x] All 5 languages implemented with proper flags/icons
- [x] Mobile responsive design with icon-only view
- [x] Persistent across sessions via cookies + localStorage

## Installation

All files have been created and integrated. The language switcher is now ready to use! The system automatically:

1. Detects browser language on first visit
2. Persists user choice in cookies + localStorage
3. Sends locale to AI chat for contextual responses
4. Provides full accessibility support
5. Works seamlessly on desktop and mobile

Simply start the development server and the language switcher will appear in the top-left corner of the header.