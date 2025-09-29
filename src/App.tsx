import { useState, useRef, useEffect } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { ScrollArea } from './components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar'
import { Skeleton } from './components/ui/skeleton'
import { PaperPlaneTilt, Sparkle, Copy, ThumbsUp, ThumbsDown, ArrowUp, Paperclip, Buildings, CaretRight, Hand, Check, Trash, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { usePreferredLocale } from './hooks/usePreferredLocale'
import { messages as translations, type MessageKey } from './i18n/messages'



interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
}

// Simple localStorage hook to replace GitHub Spark's useKV
function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setStoredValue = (newValue: T | ((prev: T) => T)) => {
    try {
      const valueToStore = newValue instanceof Function ? newValue(value) : newValue
      setValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }

  const deleteStoredValue = () => {
    try {
      window.localStorage.removeItem(key)
      setValue(defaultValue)
    } catch (error) {
      console.error(`Error deleting localStorage key "${key}":`, error)
    }
  }

  return [value, setStoredValue, deleteStoredValue]
}

// Helper function to format message content with bold text
const formatMessageContent = (content: string) => {
  // Split by **text** pattern and process each part
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  
  return parts.map((part, index) => {
    // If part matches **text** pattern, make it bold
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2); // Remove the ** from both ends
      return (
        <strong key={index} className="font-semibold text-foreground">
          {boldText}
        </strong>
      );
    }
    // Otherwise, return as regular text, preserving line breaks
    return part.split('\n').map((line, lineIndex) => (
      <span key={`${index}-${lineIndex}`}>
        {line}
        {lineIndex < part.split('\n').length - 1 && <br />}
      </span>
    ));
  });
};

function App() {
  const { locale, formatMessage } = usePreferredLocale()
  const [chatMessages, setChatMessages, deleteChatMessages] = useLocalStorage<Message[]>('chat-messages', [])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [showClearModal, setShowClearModal] = useState(false)

  // Helper function to get translated message
  const t = (key: MessageKey) => {
    const translation = translations[locale as keyof typeof translations]?.[key] || translations['es-UY'][key] || key
    return translation
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [chatMessages, isLoading])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Locale changes (no-op in production, kept for possible side-effects)
  useEffect(() => {
    // intentionally silent
  }, [locale])

  // Listen for custom locale change events (silent)
  useEffect(() => {
    const handleCustomLocaleChange = () => {}
    window.addEventListener('localeChanged', handleCustomLocaleChange as EventListener)
    return () => {
      window.removeEventListener('localeChanged', handleCustomLocaleChange as EventListener)
    }
  }, [])

  // Handle language change
  const handleLanguageChange = (_newLocale: string) => {}

  const sendMessageToAI = async (messageContent: string, currentMessages: Message[]) => {
    if (!messageContent.trim() || isLoading) return

    setIsLoading(true)

    try {
      // Get conversation history for context
      const conversationHistory = (currentMessages || []).slice(-10) // Keep last 10 messages for context
      
      // Prepare payload for N8N webhook
      const payload = {
        message: messageContent.trim(),
        role: 'user',
        timestamp: Date.now(),
  sessionId: 'hotel-chat-session', // You can make this dynamic per user
  locale: locale, // Send current locale to AI
        conversationHistory: conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }))
      }

      // Send to N8N webhook
  const primaryWebhookUrl = (import.meta as any)?.env?.VITE_N8N_WEBHOOK_URL || 'https://n8n-n8n.ua4qkv.easypanel.host/webhook/8cc93673-7b91-4992-aca5-834c8e66890a'
      const response = await fetch(primaryWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': locale,
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Helper to parse a Response into assistant text
      const parseN8nResponse = async (resp: Response): Promise<string> => {
        let assistantContentInner = ''
        try {
          const contentType = resp.headers.get('content-type') || ''
          const status = resp.status
          let rawText = ''
          try { rawText = await resp.clone().text() } catch {}
          if (!rawText) { try { rawText = await resp.text() } catch {} }
          // silent logs in production; keep variables for parsing only

          const extractAssistantContent = (data: any): string => {
            try {
              if (!data) return ''
              if (typeof data === 'string') return data
              if (typeof data.output === 'string') return data.output
              if (typeof data.response === 'string') return data.response
              if (typeof data.text === 'string') return data.text
              if (typeof data.message === 'string') return data.message
              if (typeof data.content === 'string') return data.content
              if (Array.isArray(data.items)) {
                for (const item of data.items) {
                  const s = extractAssistantContent(item?.json || item)
                  if (s) return s
                }
              }
              if (data?.json) {
                const s = extractAssistantContent(data.json)
                if (s) return s
              }
              if (data?.data) {
                const s = extractAssistantContent(data.data)
                if (s) return s
              }
              if (Array.isArray(data)) {
                // Common N8N shape: array of items with { output: string, ... }
                for (const item of data) {
                  if (item && typeof item.output === 'string') return item.output
                }
                for (const item of data) {
                  const s = extractAssistantContent(item)
                  if (s) return s
                }
              }
              const keysToTry = ['output', 'response', 'text', 'message', 'content']
              for (const key of keysToTry) {
                try {
                  const val = (data as any)[key]
                  const s = extractAssistantContent(val)
                  if (s) return s
                } catch {}
              }
              return ''
            } catch {
              return ''
            }
          }

          // Whole JSON parse
          if (rawText && /^[\s\uFEFF\u200B]*[\[{]/.test(rawText)) {
            try {
              const parsed = JSON.parse(rawText)
              assistantContentInner = extractAssistantContent(parsed)
            } catch (e) {
              // ignore and fallback to NDJSON/text
            }
          }

          // NDJSON
          if (!assistantContentInner && rawText) {
            const lines = rawText.trim().split('\n')
            if (lines.length > 1) {
              for (const rawLine of lines) {
                const line = rawLine.trim()
                if (!line) continue
                try {
                  const jsonLine = JSON.parse(line)
                  if (jsonLine?.type === 'item' && typeof jsonLine.content === 'string') {
                    assistantContentInner += jsonLine.content
                  } else {
                    const s = extractAssistantContent(jsonLine)
                    if (s) assistantContentInner += s
                  }
                } catch {
                  if (!assistantContentInner) assistantContentInner = line
                }
              }
            }
          }

          // Fallback to plain text
          if (!assistantContentInner && rawText) {
            assistantContentInner = rawText
          }
        } catch (error) {
          // silent catch, leave empty to trigger fallbacks above
          assistantContentInner = ''
        }
        return assistantContentInner
      }

      // Parse primary response
      let assistantContent = await parseN8nResponse(response)

      // Fallback: if empty, try the test URL (useful when prod webhook is configured to respond without body)
      if (!assistantContent) {
        try {
          const testWebhookUrl = primaryWebhookUrl.replace('/webhook/', '/webhook-test/')
          const responseTest = await fetch(testWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': locale,
            },
            body: JSON.stringify(payload)
          })
          if (responseTest.ok) {
            assistantContent = await parseN8nResponse(responseTest)
          }
        } catch {
          // ignore
        }
      }
      
      // Create assistant message with parsed content
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: assistantContent || t('error.unavailable'),
        role: 'assistant',
        timestamp: Date.now() + 1
      }

      setChatMessages([...currentMessages, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: t('error.processing'),
        role: 'assistant',
        timestamp: Date.now() + 1
      }
      setChatMessages([...currentMessages, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      role: 'user',
      timestamp: Date.now()
    }

    const messageToSend = inputValue.trim()
    setInputValue('')
    
    // Add user message immediately and get updated messages
    const updatedMessages = [...(chatMessages || []), userMessage]
    setChatMessages(updatedMessages)
    
    // Send to AI with the updated messages that include the user message
    await sendMessageToAI(messageToSend, updatedMessages)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const clearChat = () => {
    setChatMessages([])
    setShowClearModal(false)
  }

  const handleClearClick = () => {
    setShowClearModal(true)
  }



  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Header with language selector */}
      <motion.div 
        className="flex items-center justify-between flex-shrink-0 p-3 border-b sm:p-4 bg-background/95 backdrop-blur-sm border-border/50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Language switcher - left */}
        <motion.div 
          className="flex-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <LanguageSwitcher onLanguageChange={handleLanguageChange} />
        </motion.div>

        {/* Title - centered on mobile */}
        <motion.div 
          className="flex items-center gap-2 sm:gap-3 absolute left-1/2 -translate-x-1/2 sm:static sm:translate-x-0"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <motion.div 
            className="flex items-center justify-center rounded-lg shadow-sm w-7 h-7 sm:w-10 sm:h-10 sm:rounded-xl bg-primary"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Buildings size={14} className="text-primary-foreground sm:hidden" weight="bold" />
            <Buildings size={20} className="hidden text-primary-foreground sm:block" weight="bold" />
          </motion.div>
          <motion.h1 
            className="text-base font-semibold sm:text-xl text-foreground"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
          >
            {t('header.title')}
          </motion.h1>
        </motion.div>
        
        {/* Clear chat button - right */}
        <motion.div 
          className="flex justify-end flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: (chatMessages || []).length > 0 ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {(chatMessages || []).length > 0 && (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={handleClearClick}
                title={t('header.clearChat')}
              >
                <Trash size={16} />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
      {/* Main chat area */}
      <div className="flex-1 min-h-0 overflow-hidden bg-background">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="w-full max-w-md min-h-full px-3 py-4 mx-auto sm:py-6">
            {(chatMessages || []).length === 0 ? (
              <motion.div 
                className="flex flex-col justify-center h-full min-h-[60vh] space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
              >
                {/* Welcome message as chat bubble */}
                <motion.div 
                  className="flex items-start gap-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
                >
                  <motion.div 
                    className="flex items-center justify-center w-8 h-8 mt-1 rounded-full bg-muted shrink-0"
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      duration: 2,
                      delay: 1.5,
                      ease: "easeInOut",
                      times: [0, 0.3, 0.7, 1]
                    }}
                  >
                    <Hand size={16} className="text-primary" weight="fill" />
                  </motion.div>
                  <motion.div 
                    className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3 text-sm sm:text-base leading-relaxed shadow-sm max-w-[85%]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 1, ease: "easeOut" }}
                  >
                    <p className="mb-2">
                      {t('welcome.greeting')}
                    </p>
                  </motion.div>
                </motion.div>
                
                {/* Predefined questions */}
                <motion.div 
                  className="space-y-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 1.2, ease: "easeOut" }}
                >
                  <p className="mb-3 text-xs font-medium sm:text-sm text-muted-foreground">
                    {t('welcome.frequentQuestions')}
                  </p>
                  <div className="flex flex-col w-full gap-2 overflow-visible">
                    {[
                      'welcome.questions.wifi',
                      'welcome.questions.schedule',
                      'welcome.questions.transport',
                      'welcome.questions.restaurants'
                    ].map((questionKey, index) => {
                      const question = t(questionKey as MessageKey)
                      return (
                        <motion.div
                          key={questionKey}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ 
                            duration: 0.4, 
                            delay: 1.4 + index * 0.1, 
                            ease: "easeOut" 
                          }}
                        >
                          <motion.div
                            whileHover={{ 
                              scale: 1.02,
                              transition: { type: "spring", stiffness: 300, damping: 20 }
                            }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Button
                              variant="ghost"
                              className="justify-start w-full h-auto p-3 text-sm text-left transition-all duration-200 bg-muted/30 hover:bg-muted/50 rounded-xl hover:shadow-sm overflow-visible"
                              onClick={async () => {
                                setInputValue(question)
                                
                                setTimeout(async () => {
                                  const userMessage: Message = {
                                    id: Date.now().toString(),
                                    content: question,
                                    role: 'user',
                                    timestamp: Date.now()
                                  }
                                  
                                  const updatedMessages = [...(chatMessages || []), userMessage]
                                  setChatMessages(updatedMessages)
                                  setInputValue('')
                                  
                                  await sendMessageToAI(question, updatedMessages)
                                }, 300)
                              }}
                            >
                              <div className="flex items-start w-full gap-3 overflow-hidden">
                                <motion.div 
                                  className="text-primary shrink-0 mt-0.5"
                                  whileHover={{ x: 2 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                >
                                  <CaretRight size={14} weight="bold" />
                                </motion.div>
                                <span className="flex-1 overflow-hidden leading-relaxed text-left break-words whitespace-normal text-foreground">{question}</span>
                              </div>
                            </Button>
                          </motion.div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <div className="w-full space-y-3 sm:space-y-4">
                <AnimatePresence mode="popLayout">
                  {(chatMessages || []).map((message, index) => (
                    <motion.div 
                      key={message.id} 
                      className="w-full"
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ 
                        duration: 0.4, 
                        delay: index * 0.05,
                        ease: "easeOut",
                        type: "spring",
                        stiffness: 300,
                        damping: 25
                      }}
                      layout
                    >
                      {message.role === 'user' ? (
                        <div className="flex justify-end">
                          <motion.div 
                            className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] sm:max-w-[70%] text-sm sm:text-base leading-relaxed shadow-sm"
                            whileHover={{ scale: 1.02 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <p className="break-words">{message.content}</p>
                          </motion.div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <motion.div 
                            className="flex items-center justify-center w-8 h-8 mt-1 rounded-full bg-muted shrink-0"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ 
                              duration: 0.5, 
                              delay: 0.2,
                              type: "spring",
                              stiffness: 200,
                              damping: 15
                            }}
                          >
                            <motion.div
                              animate={{ 
                                rotate: [0, 10, -10, 0],
                                scale: [1, 1.1, 0.9, 1]
                              }}
                              transition={{ 
                                duration: 3,
                                delay: 0.5,
                                ease: "easeInOut",
                                repeat: Infinity,
                                repeatDelay: 5
                              }}
                            >
                              <Sparkle size={14} className="text-muted-foreground" weight="fill" />
                            </motion.div>
                          </motion.div>
                          <div className="flex-1 max-w-[80%] sm:max-w-[70%]">
                            <motion.div 
                              className="bg-muted/50 text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm sm:text-base leading-relaxed shadow-sm"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.6, delay: 0.3 }}
                            >
                              <div className="break-words whitespace-pre-wrap">
                                {formatMessageContent(message.content)}
                              </div>
                            </motion.div>
                            <motion.div 
                              className="flex items-center gap-1 px-2 mt-1"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 0.5 }}
                            >
                              <motion.div
                                whileHover={{ scale: 1.1, y: -1 }}
                                whileTap={{ scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                              >
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={`w-6 h-6 transition-all duration-300 ${
                                    copiedMessageId === message.id 
                                      ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                                      : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(message.content)
                                    setCopiedMessageId(message.id)
                                    setTimeout(() => setCopiedMessageId(null), 2000)
                                  }}
                                  title={t('chat.copy')}
                                >
                                  <AnimatePresence mode="wait">
                                    {copiedMessageId === message.id ? (
                                      <motion.div
                                        key="check"
                                        initial={{ scale: 0, rotate: 180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        exit={{ scale: 0, rotate: -180 }}
                                        transition={{ duration: 0.2 }}
                                      >
                                        <Check size={12} weight="bold" />
                                      </motion.div>
                                    ) : (
                                      <motion.div
                                        key="copy"
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        exit={{ scale: 0, rotate: 180 }}
                                        transition={{ duration: 0.2 }}
                                      >
                                        <Copy size={12} />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </Button>
                              </motion.div>
                            </motion.div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Loading indicator */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div 
                      className="w-full"
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.9 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <div className="flex items-start gap-2">
                        <motion.div 
                          className="flex items-center justify-center w-8 h-8 mt-1 rounded-full bg-muted shrink-0"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            <Sparkle size={14} className="text-muted-foreground" weight="fill" />
                          </motion.div>
                        </motion.div>
                        <motion.div 
                          className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3 max-w-[80%] sm:max-w-[70%] shadow-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        >
                          <div className="flex items-center gap-1.5">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-2 h-2 rounded-full bg-muted-foreground"
                                animate={{
                                  scale: [1, 1.5, 1],
                                  opacity: [0.5, 1, 0.5]
                                }}
                                transition={{
                                  duration: 1.2,
                                  repeat: Infinity,
                                  delay: i * 0.2,
                                  ease: "easeInOut"
                                }}
                              />
                            ))}
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      {/* Input area matching the image */}
      <motion.div 
        className="flex-shrink-0 p-3 pb-8 border-t sm:p-4 sm:pb-10 bg-background/95 backdrop-blur-sm border-border/50 safe-area-inset-bottom mobile-input-area"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
        style={{ 
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))',
          marginBottom: 'env(keyboard-inset-height, 0px)',
          position: 'relative',
          zIndex: 10
        } as React.CSSProperties}
      >
        <div className="w-full max-w-md px-3 mx-auto">
          <div className="relative w-full input-container">
            <motion.div 
              className="flex items-center w-full gap-2 p-3 transition-all duration-200 bg-white border border-border rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"
              whileHover={{ scale: 1.005 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="flex-1 min-w-0">
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={t('input.placeholder')}
                  className="w-full p-0 text-sm bg-white border-0 shadow-none sm:text-base placeholder:text-muted-foreground"
                  disabled={isLoading}
                  style={{ 
                    outline: 'none',
                    border: 'none',
                    boxShadow: 'none',
                    background: 'white'
                  }}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Send button */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <motion.div
                    animate={inputValue.trim() ? { 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, 0]
                    } : {}}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  >
                    <Button
                      onClick={handleSendMessage}
                      disabled={isLoading || !inputValue.trim()}
                      size="icon"
                      className="transition-all duration-200 rounded-full w-7 h-7 sm:w-8 sm:h-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      title={t('input.send')}
                    >
                      <motion.div
                        animate={isLoading ? { rotate: 360 } : {}}
                        transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: "linear" }}
                      >
                        <CaretRight size={14} className="sm:hidden" weight="bold" />
                        <CaretRight size={16} className="hidden sm:block" weight="bold" />
                      </motion.div>
                    </Button>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Clear Chat Modal */}
      <AnimatePresence>
        {showClearModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowClearModal(false)}
          >
            <motion.div
              className="w-full max-w-sm p-6 border shadow-2xl bg-background border-border rounded-2xl"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
                  <Trash size={20} className="text-destructive" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {t('clear.title')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('clear.subtitle')}
                  </p>
                </div>
              </div>
              
              <p className="mb-6 text-sm text-muted-foreground">
                {t('clear.description')}
              </p>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowClearModal(false)}
                >
                  {t('clear.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={clearChat}
                >
                  {t('clear.confirm')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App