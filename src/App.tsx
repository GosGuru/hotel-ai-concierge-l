import { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PaperPlaneTilt, Sparkle, Copy, ThumbsUp, ThumbsDown, ArrowUp, Microphone, Paperclip } from '@phosphor-icons/react'

// Declare spark global
declare global {
  interface Window {
    spark: {
      llmPrompt: (strings: TemplateStringsArray, ...values: any[]) => string
      llm: (prompt: string, modelName?: string, jsonMode?: boolean) => Promise<string>
    }
  }
}

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
}

function App() {
  const [messages, setMessages, deleteMessages] = useKV<Message[]>('chat-messages', [])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages, isLoading])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      role: 'user',
      timestamp: Date.now()
    }

    // Add user message immediately
    setMessages(currentMessages => [...(currentMessages || []), userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Create prompt for the AI
      const conversationHistory = (messages || []).slice(-10) // Keep last 10 messages for context
      const contextMessages = conversationHistory.map(msg => 
        `${msg.role === 'user' ? 'Huésped' : 'Asistente'}: ${msg.content}`
      ).join('\n')
      
      const prompt = window.spark.llmPrompt`Eres un asistente profesional de hotel de lujo. Responde de manera elegante, útil y profesional a las consultas de los huéspedes. Mantén un tono cordial pero sofisticado.

${contextMessages ? `Conversación previa:\n${contextMessages}\n\n` : ''}Consulta actual del huésped: ${userMessage.content}

Por favor proporciona una respuesta profesional y útil como asistente de hotel.`

      const response = await window.spark.llm(prompt, 'gpt-4o')

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        role: 'assistant',
        timestamp: Date.now() + 1
      }

      setMessages(currentMessages => [...(currentMessages || []), assistantMessage])
    } catch (error) {
      console.error('Error getting AI response:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Disculpe, he encontrado un error al procesar su consulta. Por favor, inténtelo nuevamente.',
        role: 'assistant',
        timestamp: Date.now() + 1
      }
      setMessages(currentMessages => [...(currentMessages || []), errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header - minimalist like the reference */}
      <div className="flex items-center justify-between p-4 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <div className="grid grid-cols-2 gap-0.5 w-3 h-3">
              <div className="w-1 h-1 bg-current rounded-[1px]"></div>
              <div className="w-1 h-1 bg-current rounded-[1px]"></div>
              <div className="w-1 h-1 bg-current rounded-[1px]"></div>
              <div className="w-1 h-1 bg-current rounded-[1px]"></div>
            </div>
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <span className="text-lg font-light">+</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-xs px-2 h-7 border border-border/30">
            <span>🏨</span>
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="default" 
            size="sm" 
            className="bg-primary text-primary-foreground rounded-full px-4 h-8 text-sm font-medium"
          >
            Hola
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Copy size={14} />
          </Button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full chat-scrollbar">
          <div className="max-w-2xl mx-auto px-4">
            {(messages || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <div className="mb-6">
                  <Sparkle size={24} className="text-muted-foreground" />
                </div>
                <h1 className="text-xl font-medium text-foreground mb-2">
                  ¡Hola! ¿En qué puedo ayudarte hoy?
                </h1>
              </div>
            ) : (
              <div className="py-8 space-y-6">
                {(messages || []).map((message) => (
                  <div key={message.id} className="animate-in slide-in-from-bottom-2 duration-300">
                    {message.role === 'user' ? (
                      <div className="flex justify-end mb-4">
                        <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2 max-w-[80%] text-sm">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 mb-6">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                          <Sparkle size={12} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                            {message.content}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground">
                              <Copy size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground">
                              <ThumbsUp size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground">
                              <ThumbsDown size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-3 mb-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                      <Sparkle size={12} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-16 bg-muted" />
                      <Skeleton className="h-3 w-24 bg-muted" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input area */}
      <div className="p-4 pb-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <div className="flex items-end gap-2 bg-card border border-border rounded-2xl p-3">
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground shrink-0">
                <Paperclip size={16} />
              </Button>
              
              <div className="flex-1">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Envía un mensaje..."
                  className="border-0 bg-transparent p-0 text-sm focus-visible:ring-0 placeholder:text-muted-foreground resize-none"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
                  <Microphone size={16} />
                </Button>
                
                {inputValue.trim() ? (
                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading}
                    size="icon"
                    className="w-8 h-8 bg-foreground text-background hover:bg-foreground/90 rounded-full"
                  >
                    <ArrowUp size={16} />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          
          {/* Model selector like in reference */}
          <div className="flex items-center justify-center mt-3">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2 hover:text-foreground">
              <Sparkle size={12} className="mr-1" />
              Asistente Profesional
              <span className="ml-2">⌄</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App