"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Home, Search, Briefcase, Menu, Send } from "lucide-react"

type Message = {
  id: string
  role: "user" | "coach"
  content: string
  timestamp: string
}

export default function CareerCoachChatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "coach",
      content:
        "Hello! I'm your career coach. I'm here to help you navigate your professional journey. What would you like to discuss today?",
      timestamp: "9:32 AM",
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isSpeaking, setIsSpeaking] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-speaking animation when coach messages arrive
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === "coach") {
      setIsSpeaking(true)
      // Stop speaking after message "finishes"
      const timer = setTimeout(() => {
        setIsSpeaking(false)
      }, lastMessage.content.length * 50)
      return () => clearTimeout(timer)
    }
  }, [messages])

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    // Stop coach from speaking when user asks question
    setIsSpeaking(false)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsTyping(true)

    // Simulate coach response
    setTimeout(() => {
      const responses = [
        "That's a great question! Let me help you think through that. Career transitions can be challenging, but with the right strategy and mindset, you can make a successful move.",
        "I understand your concern. Many professionals face similar challenges. Let's break this down into actionable steps that you can start implementing today.",
        "Excellent! It sounds like you're ready to take the next step in your career. Have you considered updating your LinkedIn profile and networking strategy?",
        "That's an important milestone you're working toward. Let's create a roadmap to help you achieve your goals. What timeline are you working with?",
      ]

      const coachMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      }

      setIsTyping(false)
      setMessages((prev) => [...prev, coachMessage])
    }, 2000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleStartRecording = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      setIsSpeaking(false)
      // In a real app, this would start voice recording
      console.log("[v0] Starting voice recording...")
    } else {
      console.log("[v0] Stopping voice recording...")
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-6 py-4 rounded-b-3xl shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Menu className="w-5 h-5 md:hidden" />
            <h1 className="text-lg md:text-xl font-semibold">CareerPath</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Home className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Search className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Briefcase className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              className="hidden md:flex bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              Career Resources
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:py-12">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Coach Avatar Section */}
          <div className="flex flex-col items-center justify-center space-y-6 md:sticky md:top-8">
            <div className="relative">
              {/* Pulse effect when speaking */}
              {isSpeaking && (
                <div className="absolute inset-0 rounded-full bg-accent/30 animate-pulse-glow scale-110" />
              )}

              {/* Avatar */}
              <div
                className={`relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden bg-gradient-to-br from-accent to-accent/70 shadow-2xl transition-transform duration-300 ${isSpeaking ? "animate-speak" : ""}`}
              >
                <svg viewBox="0 0 400 400" className="w-full h-full">
                  {/* Head */}
                  <ellipse cx="200" cy="180" rx="100" ry="120" fill="#f4a261" />

                  {/* Hair */}
                  <path d="M100 140 Q100 60 200 60 Q300 60 300 140" fill="#2d3748" />
                  <path d="M100 140 L100 180 Q100 120 130 110 Z" fill="#2d3748" />
                  <path d="M300 140 L300 180 Q300 120 270 110 Z" fill="#2d3748" />

                  {/* Eyes */}
                  <ellipse cx="165" cy="170" rx="15" ry="20" fill="#2d3748" />
                  <ellipse cx="235" cy="170" rx="15" ry="20" fill="#2d3748" />
                  <ellipse cx="170" cy="168" rx="6" ry="8" fill="white" />
                  <ellipse cx="240" cy="168" rx="6" ry="8" fill="white" />

                  {/* Nose */}
                  <path d="M200 185 L195 205 L205 205 Z" fill="#e76f51" opacity="0.5" />

                  {/* Mouth - changes based on speaking */}
                  {isSpeaking ? (
                    <ellipse cx="200" cy="220" rx="30" ry="15" fill="#2d3748" opacity="0.8" />
                  ) : (
                    <path d="M180 220 Q200 230 220 220" stroke="#2d3748" strokeWidth="3" fill="none" />
                  )}

                  {/* Shirt */}
                  <path
                    d="M100 290 Q100 310 120 320 L200 380 L280 320 Q300 310 300 290 L300 280 L250 300 L200 290 L150 300 L100 280 Z"
                    fill="#4a5568"
                  />
                  <circle cx="200" cy="305" r="3" fill="white" />
                  <circle cx="200" cy="320" r="3" fill="white" />
                </svg>
              </div>

              {/* Speaking indicator */}
              {isSpeaking && (
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-accent text-accent-foreground px-4 py-2 rounded-full shadow-lg">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Sarah Mitchell</h2>
              <p className="text-muted-foreground">Senior Career Coach</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                15+ years helping professionals find their path and achieve their career goals
              </p>
            </div>

            {/* Start Recording button */}
            <Button
              onClick={handleStartRecording}
              className={`px-8 py-3 text-base font-medium ${
                isRecording
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>
          </div>

          {/* Chat Section */}
          <div className="flex flex-col h-[600px]">
            <Card className="flex-1 flex flex-col shadow-xl overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {message.role === "coach" && <p className="font-semibold text-sm mb-1 text-foreground">Coach:</p>}
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 px-2">{message.timestamp}</span>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-start">
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-border p-4 bg-card">
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your career goals..."
                    className="flex-1 text-base"
                  />
                  <Button
                    onClick={handleSendMessage}
                    size="icon"
                    className="bg-primary hover:bg-primary/90"
                    disabled={!inputValue.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setInputValue("How do I negotiate a better salary?")}>
                Salary Tips
              </Button>
              <Button variant="outline" size="sm" onClick={() => setInputValue("I want to change careers")}>
                Career Change
              </Button>
              <Button variant="outline" size="sm" onClick={() => setInputValue("Help me prepare for an interview")}>
                Interview Prep
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
