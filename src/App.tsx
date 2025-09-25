import { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PaperPlaneTilt, Sparkle, Copy, ThumbsUp, ThumbsDown, ArrowUp, Microphone, MicrophoneSlash, Paperclip, Buildings } from '@phosphor-icons/react'

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
    <div className="flex flex-col h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0">
        <div 
          className="w-full h-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('data:image/svg+xml;base64,${btoa(`
              <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="hotelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#334155;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#475569;stop-opacity:1" />
                  </linearGradient>
                  <pattern id="hotelPattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                    <rect width="200" height="200" fill="url(#hotelGrad)"/>
                    <circle cx="50" cy="50" r="2" fill="#64748b" opacity="0.3"/>
                    <circle cx="150" cy="100" r="1.5" fill="#64748b" opacity="0.2"/>
                    <circle cx="100" cy="150" r="2.5" fill="#64748b" opacity="0.1"/>
                    <rect x="20" y="20" width="40" height="60" fill="#475569" opacity="0.2" rx="2"/>
                    <rect x="140" y="40" width="35" height="50" fill="#475569" opacity="0.15" rx="2"/>
                    <rect x="70" y="120" width="45" height="55" fill="#475569" opacity="0.18" rx="2"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hotelPattern)"/>
                <rect width="100%" height="100%" fill="url(#hotelGrad)" opacity="0.7"/>
              </svg>
            `)}`
          }}
        />
        {/* Dark overlay for better readability */}
        <div className="absolute inset-0 bg-background/85 backdrop-blur-[2px]" />
      </div>

      {/* Content */}
      <div className="flex flex-col h-full relative z-10">
      {/* Header - hotel branding */}
      <div className="flex items-center justify-center p-4 border-b border-border/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Buildings size={18} className="text-primary" />
          </div>
          <h1 className="text-lg font-medium text-foreground">Asistente Hotel</h1>
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
            <div className="flex items-end gap-2 bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-3">
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground shrink-0">
                <Paperclip size={16} />
              </Button>
              
              <div className="flex-1">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isRecording ? "Escuchando..." : "Envía un mensaje..."}
                  className="border-0 bg-transparent p-0 text-sm focus-visible:ring-0 placeholder:text-muted-foreground resize-none"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`w-8 h-8 transition-colors relative ${
                      !recognition 
                        ? 'text-muted-foreground/50 cursor-not-allowed'
                        : isRecording 
                        ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={startRecording}
                    disabled={isLoading || !recognition}
                    title={!recognition ? 'Función de voz no disponible en este navegador' : isRecording ? 'Detener grabación' : 'Grabar mensaje de voz'}
                  >
                    {isRecording ? <MicrophoneSlash size={16} /> : <Microphone size={16} />}
                    
                    {/* Audio level indicator */}
                    {isRecording && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center">
                        <div 
                          className="w-1 h-1 bg-white rounded-full transition-transform duration-100 audio-level-dot"
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
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex items-end gap-0.5 h-4">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-red-400 rounded-full transition-all duration-100 wave-bar"
                          style={{
                            height: `${Math.max(4, (audioLevel * 12) + 4)}px`,
                            opacity: 0.7 + audioLevel * 0.3,
                            animationDelay: `${i * 80}ms`,
                            animationDuration: `${400 + i * 100}ms`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                
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
          

        </div>
      </div>
      </div>
    </div>
  )
}

export default App