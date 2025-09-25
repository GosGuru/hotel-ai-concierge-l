import { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PaperPlaneTilt, User, Robot } from '@phosphor-icons/react'

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
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n')
      
      const prompt = window.spark.llmPrompt`You are a helpful AI assistant. Please respond to the user's message in a conversational and helpful way.

${contextMessages ? `Previous conversation:\n${contextMessages}\n\n` : ''}Current user message: ${userMessage.content}

Please provide a helpful, conversational response.`

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
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
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
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between p-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Robot size={16} weight="fill" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold text-foreground">AI Assistant</h1>
              <p className="text-xs text-muted-foreground">Always here to help</p>
            </div>
          </div>
          {(messages || []).length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearChat}
              className="text-muted-foreground"
            >
              Clear Chat
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full chat-scrollbar">
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            {(messages || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-full p-4 mb-4">
                  <Robot size={32} className="text-primary" weight="fill" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Welcome to AI Chat
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Start a conversation! I'm here to help answer questions, provide information, or just chat about whatever interests you.
                </p>
              </div>
            ) : (
              (messages || []).map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 animate-in slide-in-from-bottom-2 duration-300 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback 
                      className={message.role === 'user' 
                        ? 'bg-secondary text-secondary-foreground' 
                        : 'bg-primary text-primary-foreground'
                      }
                    >
                      {message.role === 'user' ? (
                        <User size={16} weight="fill" />
                      ) : (
                        <Robot size={16} weight="fill" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <Card 
                    className={`max-w-[70%] p-3 ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground ml-auto' 
                        : 'bg-card text-card-foreground'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </Card>
                </div>
              ))
            )}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 animate-in slide-in-from-bottom-2 duration-300">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Robot size={16} weight="fill" />
                  </AvatarFallback>
                </Avatar>
                <Card className="max-w-[70%] p-3 bg-card text-card-foreground">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              className="shrink-0"
            >
              <PaperPlaneTilt size={16} weight="fill" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App