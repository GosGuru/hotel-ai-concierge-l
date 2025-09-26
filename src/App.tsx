import { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PaperPlaneTilt, Sparkle, Copy, ThumbsUp, ThumbsDown, ArrowUp, Microphone, MicrophoneSlash, Paperclip, Buildings, CaretRight, Hand } from '@phosphor-icons/react'

// Speech Recognition types
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (event: SpeechRecognitionEvent) => void
  onerror: (event: SpeechRecognitionErrorEvent) => void
  onstart: () => void
  onend: () => void
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}

// Declare spark global (removed since we're using N8N)
declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition
    }
    webkitSpeechRecognition: {
      new(): SpeechRecognition
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
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages, isLoading])

  // Focus input on mount and initialize speech recognition
  useEffect(() => {
    inputRef.current?.focus()
    
    // Initialize Speech Recognition
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'es-ES'
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInputValue(prev => prev + transcript)
        setIsRecording(false)
      }
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
        stopAudioLevelMonitoring()
      }
      
      recognition.onend = () => {
        setIsRecording(false)
        stopAudioLevelMonitoring()
      }
      
      setRecognition(recognition)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioLevelMonitoring()
    }
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
      // Get conversation history for context
      const conversationHistory = (messages || []).slice(-10) // Keep last 10 messages for context
      
      // Prepare payload for N8N webhook
      const payload = {
        message: userMessage.content,
        role: 'user',
        timestamp: Date.now(),
        sessionId: 'hotel-chat-session', // You can make this dynamic per user
        conversationHistory: conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }))
      }

      // Send to N8N webhook
      const response = await fetch('https://n8n-n8n.ua4qkv.easypanel.host/webhook/8cc93673-7b91-4992-aca5-834c8e66890a', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Parse N8N streaming response (JSONL format)
      const responseText = await response.text()
      console.log('N8N Response (raw):', responseText)
      
      // Parse streaming JSONL response
      let assistantContent = ''
      
      try {
        // Split by lines and parse each JSON object
        const lines = responseText.trim().split('\n')
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const jsonData = JSON.parse(line)
              
              // Extract content from streaming data
              if (jsonData.type === 'item' && jsonData.content) {
                assistantContent += jsonData.content
              }
            } catch (lineError) {
              console.warn('Could not parse line:', line, lineError)
            }
          }
        }
        
        // Fallback: if no streaming content found, try parsing as single JSON
        if (!assistantContent && responseText) {
          try {
            const singleData = JSON.parse(responseText)
            assistantContent = singleData.response || singleData.message || singleData.text || ''
          } catch {
            // Final fallback: use raw text
            assistantContent = responseText
          }
        }
        
      } catch (error) {
        console.error('Error parsing N8N response:', error)
        assistantContent = 'Lo siento, no he podido procesar su consulta en este momento.'
      }
      
      // Create assistant message with parsed content
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: assistantContent || 'Lo siento, no he podido procesar su consulta en este momento.',
        role: 'assistant',
        timestamp: Date.now() + 1
      }

      setMessages(currentMessages => [...(currentMessages || []), assistantMessage])
    } catch (error) {
      console.error('Error sending message to N8N:', error)
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

  const startRecording = async () => {
    if (!recognition) {
      // Fallback: mostrar mensaje informativo
      const fallbackMessage = 'La funcionalidad de voz no está disponible en este navegador. Por favor, escribe tu mensaje.'
      console.warn('Speech recognition not supported')
      
      // Podrías mostrar un toast aquí si tienes la librería instalada
      // toast.warning(fallbackMessage)
      
      return
    }

    if (isRecording) {
      recognition.stop()
      setIsRecording(false)
      stopAudioLevelMonitoring()
    } else {
      try {
        // Solicitar permisos de micrófono y configurar análisis de audio
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setupAudioLevelMonitoring(stream)
        
        recognition.start()
        setIsRecording(true)
      } catch (error) {
        console.error('Error starting recognition:', error)
        setIsRecording(false)
      }
    }
  }

  const setupAudioLevelMonitoring = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      
      monitorAudioLevel()
    } catch (error) {
      console.error('Error setting up audio monitoring:', error)
    }
  }

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    // Calcular el nivel promedio de audio
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedLevel = Math.min(average / 128, 1) // Normalizar a 0-1
    
    setAudioLevel(normalizedLevel)
    
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel)
    }
  }

  const stopAudioLevelMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    analyserRef.current = null
    setAudioLevel(0)
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header - hotel branding matching the image */}
      <div className="flex items-center justify-center p-4 sm:p-6 border-b border-border bg-background">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary flex items-center justify-center shadow-sm">
            <Buildings size={16} className="text-primary-foreground sm:hidden" weight="bold" />
            <Buildings size={24} className="text-primary-foreground hidden sm:block" weight="bold" />
          </div>
          <h1 className="text-lg sm:text-2xl font-semibold text-foreground">Asistente Villa Sardinero</h1>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 overflow-hidden bg-background">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="max-w-sm sm:max-w-md mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {(messages || []).length === 0 ? (
              <div className="flex flex-col items-start justify-center h-full min-h-[60vh]">
                {/* Welcome message matching the image */}
                <div className="mb-6 sm:mb-8">
                  <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6">
                    <div className="text-xl sm:text-2xl">
                      <Hand size={24} className="text-primary sm:hidden" weight="fill" />
                      <Hand size={28} className="text-primary hidden sm:block" weight="fill" />
                    </div>
                    <div className="text-sm sm:text-base leading-relaxed text-foreground">
                      <p className="mb-3 sm:mb-4">
                        Hola! Soy tu asistente digital 24/7. Puedo ayudarte con dudas, recomendaciones locales y funcionamiento.
                      </p>
                    </div>
                  </div>
                  
                  {/* Predefined questions */}
                  <div className="space-y-2 sm:space-y-3">
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-3 sm:mb-4">
                      Preguntas frecuentes:
                    </p>
                    <div className="grid gap-2 sm:gap-3">
                      <Button
                        variant="outline"
                        className="justify-start text-left h-auto p-3 sm:p-4 bg-card hover:bg-muted border-border rounded-xl sm:rounded-2xl text-sm sm:text-base"
                        onClick={() => setInputValue('¿Cuál es la clave wifi?')}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="text-primary">
                            <CaretRight size={14} className="sm:hidden" weight="bold" />
                            <CaretRight size={16} className="hidden sm:block" weight="bold" />
                          </div>
                          <span className="text-foreground">¿Cuál es la clave wifi?</span>
                        </div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="justify-start text-left h-auto p-3 sm:p-4 bg-card hover:bg-muted border-border rounded-xl sm:rounded-2xl text-sm sm:text-base"
                        onClick={() => setInputValue('¿Cuáles son los horarios de desayunos, comidas y cenas?')}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="text-primary">
                            <CaretRight size={14} className="sm:hidden" weight="bold" />
                            <CaretRight size={16} className="hidden sm:block" weight="bold" />
                          </div>
                          <span className="text-foreground">¿Cuáles son los horarios de desayunos, comidas y cenas?</span>
                        </div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="justify-start text-left h-auto p-3 sm:p-4 bg-card hover:bg-muted border-border rounded-xl sm:rounded-2xl text-sm sm:text-base"
                        onClick={() => setInputValue('Necesito la guía de transporte público')}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="text-primary">
                            <CaretRight size={14} className="sm:hidden" weight="bold" />
                            <CaretRight size={16} className="hidden sm:block" weight="bold" />
                          </div>
                          <span className="text-foreground">Necesito la guía de transporte público</span>
                        </div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="justify-start text-left h-auto p-3 sm:p-4 bg-card hover:bg-muted border-border rounded-xl sm:rounded-2xl text-sm sm:text-base"
                        onClick={() => setInputValue('Restaurantes recomendados cercanos')}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="text-primary">
                            <CaretRight size={14} className="sm:hidden" weight="bold" />
                            <CaretRight size={16} className="hidden sm:block" weight="bold" />
                          </div>
                          <span className="text-foreground">Restaurantes recomendados cercanos</span>
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {(messages || []).map((message) => (
                  <div key={message.id} className="animate-in slide-in-from-bottom-2 duration-300">
                    {message.role === 'user' ? (
                      <div className="flex justify-end mb-3 sm:mb-4">
                        <div className="bg-primary text-primary-foreground rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 max-w-[85%] text-sm sm:text-base">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                          <Sparkle size={12} className="text-muted-foreground sm:hidden" weight="fill" />
                          <Sparkle size={16} className="text-muted-foreground hidden sm:block" weight="fill" />
                        </div>
                        <div className="flex-1 space-y-2 sm:space-y-3">
                          <div className="text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-wrap">
                            {message.content}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button variant="ghost" size="icon" className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground hover:text-foreground">
                              <Copy size={12} className="sm:hidden" />
                              <Copy size={16} className="hidden sm:block" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground hover:text-foreground">
                              <ThumbsUp size={12} className="sm:hidden" />
                              <ThumbsUp size={16} className="hidden sm:block" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground hover:text-foreground">
                              <ThumbsDown size={12} className="sm:hidden" />  
                              <ThumbsDown size={16} className="hidden sm:block" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                      <Sparkle size={12} className="text-muted-foreground animate-pulse sm:hidden" weight="fill" />
                      <Sparkle size={16} className="text-muted-foreground animate-pulse hidden sm:block" weight="fill" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 sm:h-4 w-16 sm:w-20 bg-muted" />
                      <Skeleton className="h-3 sm:h-4 w-24 sm:w-32 bg-muted" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input area matching the image */}
      <div className="p-4 sm:p-6 pb-6 sm:pb-8 bg-background">
        <div className="max-w-sm sm:max-w-md mx-auto">
          <div className="relative">
            <div className="flex items-center gap-2 sm:gap-3 bg-background border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4">
              <div className="flex-1">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe tu consulta..."
                  className="border-0 bg-transparent p-0 text-sm sm:text-base focus-visible:ring-0 shadow-none placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Voice recording button */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors relative rounded-full ${ 
                      !recognition 
                        ? 'text-muted-foreground/50 cursor-not-allowed'
                        : isRecording 
                        ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    onClick={startRecording}
                    disabled={isLoading || !recognition}
                    title={!recognition ? 'Función de voz no disponible en este navegador' : isRecording ? 'Detener grabación' : 'Grabar mensaje de voz'}
                  >
                    {isRecording ? (
                      <>
                        <MicrophoneSlash size={16} className="sm:hidden" />
                        <MicrophoneSlash size={20} className="hidden sm:block" />
                      </>
                    ) : (
                      <>
                        <Microphone size={16} className="sm:hidden" />
                        <Microphone size={20} className="hidden sm:block" />
                      </>
                    )}
                    
                    {/* Audio level indicator */}
                    {isRecording && (
                      <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500 flex items-center justify-center">
                        <div 
                          className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-white rounded-full transition-transform duration-100 audio-level-dot"
                          style={{ 
                            transform: `scale(${0.8 + audioLevel * 0.8})`,
                            opacity: 0.8 + audioLevel * 0.2
                          }}
                        />
                      </div>
                    )}
                  </Button>
                  
                  {/* Audio waveform visualization */}
                  {isRecording && (
                    <div className="absolute -bottom-6 sm:-bottom-8 left-1/2 transform -translate-x-1/2 flex items-end gap-0.5 h-3 sm:h-4">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-red-400 rounded-full transition-all duration-100 wave-bar"
                          style={{
                            height: `${Math.max(3, (audioLevel * 10) + 3)}px`,
                            opacity: 0.7 + audioLevel * 0.3,
                            animationDelay: `${i * 80}ms`,
                            animationDuration: `${400 + i * 100}ms`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Send button */}
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim()}
                  size="icon"
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full disabled:opacity-50"
                >
                  <CaretRight size={16} className="sm:hidden" weight="bold" />
                  <CaretRight size={20} className="hidden sm:block" weight="bold" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App