import { useState, useRef, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PaperPlaneTilt, Sparkle, Copy, ThumbsUp, ThumbsDown, ArrowUp, Microphone, MicrophoneSlash, Paperclip, Buildings, CaretRight, Hand } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

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
      <motion.div 
        className="flex items-center justify-center p-3 sm:p-4 border-b border-border bg-background"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div 
          className="flex items-center gap-2 sm:gap-3"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <motion.div 
            className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary flex items-center justify-center shadow-sm"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Buildings size={14} className="text-primary-foreground sm:hidden" weight="bold" />
            <Buildings size={20} className="text-primary-foreground hidden sm:block" weight="bold" />
          </motion.div>
          <motion.h1 
            className="text-base sm:text-xl font-semibold text-foreground"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
          >
            Asistente Villa Sardinero
          </motion.h1>
        </motion.div>
      </motion.div>
      {/* Main chat area */}
      <div className="flex-1 overflow-hidden bg-background">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="w-full max-w-full px-3 sm:px-4 py-4 sm:py-6">
            {(messages || []).length === 0 ? (
              <motion.div 
                className="flex flex-col items-start justify-center h-full min-h-[60vh] max-w-full"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
              >
                {/* Welcome message matching the image */}
                <div className="mb-4 sm:mb-6 w-full">
                  <motion.div 
                    className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
                  >
                    <motion.div 
                      className="text-xl sm:text-2xl shrink-0"
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
                      <Hand size={20} className="text-primary sm:hidden" weight="fill" />
                      <Hand size={24} className="text-primary hidden sm:block" weight="fill" />
                    </motion.div>
                    <motion.div 
                      className="text-sm sm:text-base leading-relaxed text-foreground flex-1 min-w-0"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 1, ease: "easeOut" }}
                    >
                      <p className="mb-2 sm:mb-3">
                        Hola! Soy tu asistente digital 24/7. Puedo ayudarte con dudas, recomendaciones locales y funcionamiento.
                      </p>
                    </motion.div>
                  </motion.div>
                  
                  {/* Predefined questions */}
                  <motion.div 
                    className="space-y-2 w-full"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.2, ease: "easeOut" }}
                  >
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-2 sm:mb-3">
                      Preguntas frecuentes:
                    </p>
                    <div className="grid gap-2 w-full">
                      {[
                        '¿Cuál es la clave wifi?',
                        '¿Cuáles son los horarios de desayunos, comidas y cenas?',
                        'Necesito la guía de transporte público',
                        'Restaurantes recomendados cercanos'
                      ].map((question, index) => (
                        <motion.div
                          key={question}
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
                              x: 4,
                              transition: { type: "spring", stiffness: 300, damping: 20 }
                            }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Button
                              variant="outline"
                              className="justify-start text-left h-auto p-2.5 sm:p-3 bg-card hover:bg-muted border-border rounded-lg sm:rounded-xl text-xs sm:text-sm w-full transition-all duration-200 hover:shadow-sm"
                              onClick={() => setInputValue(question)}
                            >
                              <div className="flex items-center gap-2 w-full min-w-0">
                                <motion.div 
                                  className="text-primary shrink-0"
                                  whileHover={{ x: 2 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                >
                                  <CaretRight size={12} className="sm:hidden" weight="bold" />
                                  <CaretRight size={14} className="hidden sm:block" weight="bold" />
                                </motion.div>
                                <span className="text-foreground truncate">{question}</span>
                              </div>
                            </Button>
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-3 sm:space-y-4 w-full max-w-full">
                <AnimatePresence mode="popLayout">
                  {(messages || []).map((message, index) => (
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
                        <div className="flex justify-end w-full px-0">
                          <motion.div 
                            className="bg-primary text-primary-foreground rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 max-w-[85%] text-sm sm:text-base break-words"
                            whileHover={{ scale: 1.02 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            {message.content}
                          </motion.div>
                        </div>
                      ) : (
                        <div className="flex gap-2 sm:gap-3 w-full px-0">
                          <motion.div 
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 sm:mt-1"
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
                              <Sparkle size={10} className="text-muted-foreground sm:hidden" weight="fill" />
                              <Sparkle size={12} className="text-muted-foreground hidden sm:block" weight="fill" />
                            </motion.div>
                          </motion.div>
                          <div className="flex-1 space-y-1 sm:space-y-2 min-w-0">
                            <motion.div 
                              className="text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-wrap break-words"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.6, delay: 0.3 }}
                            >
                              {message.content}
                            </motion.div>
                            <motion.div 
                              className="flex items-center gap-1"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 0.5 }}
                            >
                              {[
                                { Icon: Copy, action: 'copy' },
                                { Icon: ThumbsUp, action: 'like' },
                                { Icon: ThumbsDown, action: 'dislike' }
                              ].map(({ Icon, action }, btnIndex) => (
                                <motion.div
                                  key={action}
                                  whileHover={{ scale: 1.1, y: -1 }}
                                  whileTap={{ scale: 0.9 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                >
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground hover:text-foreground transition-colors duration-200"
                                  >
                                    <Icon size={10} className="sm:hidden" />
                                    <Icon size={12} className="hidden sm:block" />
                                  </Button>
                                </motion.div>
                              ))}
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
                      className="flex gap-2 sm:gap-3 w-full px-0"
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.9 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <motion.div 
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 sm:mt-1"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <Sparkle size={10} className="text-muted-foreground sm:hidden" weight="fill" />
                          <Sparkle size={12} className="text-muted-foreground hidden sm:block" weight="fill" />
                        </motion.div>
                      </motion.div>
                      <div className="flex-1 space-y-1 sm:space-y-2 min-w-0">
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                        >
                          <Skeleton className="h-3 sm:h-4 w-14 sm:w-16 bg-muted" />
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          transition={{ duration: 0.8, delay: 0.4 }}
                        >
                          <Skeleton className="h-3 sm:h-4 w-20 sm:w-24 bg-muted" />
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
        className="p-3 sm:p-4 pb-4 sm:pb-6 bg-background"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
      >
        <div className="w-full max-w-full px-0">
          <div className="relative w-full">
            <motion.div 
              className="flex items-center gap-2 bg-background border border-border rounded-lg sm:rounded-xl p-2.5 sm:p-3 w-full"
              whileFocus={{ scale: 1.01, borderColor: "var(--ring)" }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="flex-1 min-w-0">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe tu consulta..."
                  className="border-0 p-0 text-sm sm:text-base focus-visible:ring-0 shadow-none placeholder:text-muted-foreground bg-transparent w-full"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Voice recording button */}
                <div className="relative">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-all duration-200 relative rounded-full ${ 
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
                      <AnimatePresence mode="wait">
                        {isRecording ? (
                          <motion.div
                            key="recording"
                            initial={{ scale: 0, rotate: 180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: -180 }}
                            transition={{ duration: 0.2 }}
                          >
                            <MicrophoneSlash size={14} className="sm:hidden" />
                            <MicrophoneSlash size={16} className="hidden sm:block" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="idle"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Microphone size={14} className="sm:hidden" />
                            <Microphone size={16} className="hidden sm:block" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {/* Audio level indicator */}
                      <AnimatePresence>
                        {isRecording && (
                          <motion.div 
                            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 flex items-center justify-center"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <motion.div 
                              className="w-0.5 h-0.5 sm:w-1 sm:h-1 bg-white rounded-full"
                              animate={{ 
                                scale: [0.8 + audioLevel * 0.8, 1.2 + audioLevel * 0.8, 0.8 + audioLevel * 0.8],
                                opacity: [0.8 + audioLevel * 0.2, 1, 0.8 + audioLevel * 0.2]
                              }}
                              transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                  
                  {/* Audio waveform visualization */}
                  <AnimatePresence>
                    {isRecording && (
                      <motion.div 
                        className="absolute -bottom-5 sm:-bottom-6 left-1/2 transform -translate-x-1/2 flex items-end gap-0.5 h-2.5 sm:h-3"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-0.5 bg-red-400 rounded-full"
                            animate={{
                              height: [`${Math.max(2, (audioLevel * 4) + 2)}px`, `${Math.max(4, (audioLevel * 8) + 4)}px`, `${Math.max(2, (audioLevel * 4) + 2)}px`],
                              opacity: [0.7 + audioLevel * 0.3, 1, 0.7 + audioLevel * 0.3]
                            }}
                            transition={{
                              duration: 0.4 + i * 0.1,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: i * 0.08
                            }}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
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
                      className="w-7 h-7 sm:w-8 sm:h-8 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full disabled:opacity-50 transition-all duration-200"
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
    </div>
  );
}

export default App