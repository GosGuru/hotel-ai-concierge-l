import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './ui/button'
import { CaretDown, Check, GlobeHemisphereWest } from '@phosphor-icons/react'
import { usePreferredLocale, type Locale } from '../hooks/usePreferredLocale'

interface LanguageSwitcherProps {
  onLanguageChange?: (locale: string) => void
  className?: string
}

export function LanguageSwitcher({ onLanguageChange, className = '' }: LanguageSwitcherProps) {
  const { locale, setLocale, getCurrentLocale, supportedLocales, isInitialized } = usePreferredLocale()
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const currentLocale = getCurrentLocale()

  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
  }, [isOpen])

  // Handle clicks outside to close menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node
      if (isOpen && 
          menuRef.current && !menuRef.current.contains(target) && 
          buttonRef.current && !buttonRef.current.contains(target)) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside, true)
      document.addEventListener('touchstart', handleClickOutside, true)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true)
        document.removeEventListener('touchstart', handleClickOutside, true)
      }
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        setIsOpen(false)
        setFocusedIndex(-1)
        buttonRef.current?.focus()
        break
      case 'ArrowDown':
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setFocusedIndex(0)
        } else {
          setFocusedIndex(prev => (prev + 1) % supportedLocales.length)
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (isOpen) {
          setFocusedIndex(prev => prev <= 0 ? supportedLocales.length - 1 : prev - 1)
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setFocusedIndex(0)
        } else if (focusedIndex >= 0) {
          handleLocaleSelect(supportedLocales[focusedIndex])
        }
        break
      case 'Tab':
        if (isOpen) {
          setIsOpen(false)
          setFocusedIndex(-1)
        }
        break
    }
  }

  const handleLocaleSelect = (selectedLocale: Locale) => {
    // Close dropdown first
    setIsOpen(false)
    setFocusedIndex(-1)
    
    // Update locale immediately
    setLocale(selectedLocale.code)
    
    // Call the callback
    onLanguageChange?.(selectedLocale.code)
    
    // Return focus
    buttonRef.current?.focus()
  }

  // Don't render until hydrated to prevent mismatch
  if (!isInitialized) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-8 h-8 rounded-md bg-muted animate-pulse" />
        <div className="hidden sm:block w-16 h-4 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} data-qa="language-switcher" style={{ zIndex: 10000, position: 'relative' }}>
      {/* Desktop version */}
      <div className="hidden sm:block">
        <Button
          ref={buttonRef}
          variant="ghost"
          className="flex items-center gap-2 h-9 px-3 hover:bg-muted/50 focus:ring-2 focus:ring-primary focus:ring-offset-1"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={`Current language: ${currentLocale.nativeName}. Click to change language`}
          data-qa="language-button-desktop"
        >
          <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded" aria-hidden="true">
            {currentLocale.flag}
          </span>
          <span className="text-sm font-medium text-foreground min-w-0">
            {currentLocale.label}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <CaretDown size={12} className="text-muted-foreground" />
          </motion.div>
        </Button>
      </div>

      {/* Mobile version */}
      <div className="block sm:hidden">
        <Button
          ref={buttonRef}
          variant="outline"
          size="icon"
          className="w-10 h-10 rounded-full hover:bg-muted/60 focus:ring-2 focus:ring-primary focus:ring-offset-1"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={`Current language: ${currentLocale.nativeName}. Tap to change language`}
          data-qa="language-button-mobile"
        >
          <div className="relative flex items-center justify-center">
            <GlobeHemisphereWest size={18} className="text-primary" />
            <span className="absolute -bottom-1 -right-2 text-[10px] font-extrabold text-primary bg-primary/10 px-1 py-0.5 rounded" aria-hidden="true">
              {currentLocale.flag}
            </span>
          </div>
        </Button>
      </div>

      {/* Dropdown menu - rendered as portal */}
      {isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed w-48 bg-background border border-border rounded-lg shadow-2xl overflow-hidden"
            style={{
              zIndex: 99999,
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
            role="listbox"
            aria-label="Select language"
            data-qa="language-menu"
          >
            {supportedLocales.map((localeOption, index) => (
              <motion.button
                key={localeOption.code}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none transition-colors cursor-pointer ${
                  focusedIndex === index ? 'bg-muted' : ''
                } ${localeOption.code === locale ? 'bg-primary/5' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onTouchStart={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleLocaleSelect(localeOption)
                }}
                role="option"
                aria-selected={localeOption.code === locale}
                aria-label={`Change language to ${localeOption.nativeName}`}
                data-qa={`language-option-${localeOption.code}`}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded min-w-[2rem] text-center" aria-hidden="true">
                  {localeOption.flag}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">
                    {localeOption.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {localeOption.nativeName}
                  </div>
                </div>
                {localeOption.code === locale && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Check size={14} className="text-primary" weight="bold" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}