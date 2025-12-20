"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Home,
  Search,
  Briefcase,
  Menu,
  Send,
  Mic,
  MicOff,
  ExternalLink,
  Calendar,
  ThumbsUp,
  MessageSquare,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  askQuestion,
  type ChatMessage as ApiChatMessage,
  type Source,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSpeech } from "@/hooks/use-speech";

type Message = {
  id: string;
  role: "user" | "coach";
  content: string;
  timestamp: string;
  sources?: Source[];
  isError?: boolean;
};

export default function CareerCoachChatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "coach",
      content:
        "Hello! I'm your career coach. I'm here to help you navigate your professional journey. What would you like to discuss today?",
      timestamp: "9:32 AM",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handleSendQuestionRef = useRef<
    ((question: string) => Promise<void>) | null
  >(null);
  const previousMessageCountRef = useRef<number>(1);
  const { toast } = useToast();

  const {
    isSpeaking,
    isRecording,
    transcript,
    isSpeechSupported,
    isMuted,
    speakText,
    stopSpeaking,
    handleToggleMute,
    handleStartRecording,
    lastSpokenMessageIdRef,
  } = useSpeech((text: string) => {
    if (handleSendQuestionRef.current) {
      handleSendQuestionRef.current(text);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      const timeoutId = setTimeout(() => {
        scrollToBottom();
      }, 100);

      previousMessageCountRef.current = messages.length;
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage?.role === "coach" &&
      lastMessage.id !== "1" &&
      lastSpokenMessageIdRef.current !== lastMessage.id &&
      !isMuted &&
      !lastMessage.isError
    ) {
      stopSpeaking(true);
      lastSpokenMessageIdRef.current = lastMessage.id;
      speakText(lastMessage.content, lastMessage.id);
    }
  }, [messages, isMuted, speakText, stopSpeaking]);

  const convertMessagesToApiFormat = (msgs: Message[]): ApiChatMessage[] => {
    const messagesToSend = msgs.filter((msg) => msg.id !== "1");

    return messagesToSend.map((msg) => ({
      role: msg.role === "coach" ? "assistant" : "user",
      content: msg.content,
    }));
  };

  const handleSendQuestion = async (question: string) => {
    if (!question.trim()) return;

    stopSpeaking();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question.trim(),
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const allMessages = [...messages, userMessage];
      const chatHistory = convertMessagesToApiFormat(allMessages);
      const response = await askQuestion(question.trim(), chatHistory);

      const coachMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content: response.answer,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        sources: response.sources || [],
      };

      setIsTyping(false);
      setMessages((prev) => [...prev, coachMessage]);
    } catch (error) {
      setIsTyping(false);

      let errorMessage = "Something went wrong. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      let errorContent =
        "I'm sorry, I encountered an error. Please try again or check your connection.";
      if (
        error instanceof Error &&
        (error.message.includes("413") ||
          error.message.includes("Request Entity Too Large") ||
          error.message.includes("too large"))
      ) {
        errorContent =
          "Your question or conversation history is too long. Please try asking a shorter question or start a new conversation.";
      }

      const errorChatMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content: errorContent,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorChatMessage]);
    }
  };

  const handleSendQuestionStable = useRef(handleSendQuestion);

  useEffect(() => {
    handleSendQuestionStable.current = handleSendQuestion;
  });

  useEffect(() => {
    handleSendQuestionRef.current = handleSendQuestionStable.current;
  }, []);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    handleSendQuestion(inputValue);
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-6 py-4 rounded-b-3xl shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Menu className="w-5 h-5 md:hidden" />
            <h1 className="text-lg md:text-xl font-semibold">CareerPath</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Home className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:py-12">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="flex flex-col items-center justify-center space-y-6 md:sticky md:top-8">
            <div className="relative">
              {isSpeaking && (
                <div className="absolute inset-0 rounded-full bg-accent/30 animate-pulse-glow scale-110" />
              )}

              <div
                className={`relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden bg-gradient-to-br from-accent to-accent/70 shadow-2xl transition-transform duration-300 ${
                  isSpeaking ? "animate-speak" : ""
                }`}
              >
                <svg viewBox="0 0 400 400" className="w-full h-full">
                  <ellipse cx="200" cy="180" rx="100" ry="120" fill="#f4a261" />

                  <path
                    d="M100 140 Q100 60 200 60 Q300 60 300 140"
                    fill="#2d3748"
                  />
                  <path
                    d="M100 140 L100 180 Q100 120 130 110 Z"
                    fill="#2d3748"
                  />
                  <path
                    d="M300 140 L300 180 Q300 120 270 110 Z"
                    fill="#2d3748"
                  />

                  <ellipse cx="165" cy="170" rx="15" ry="20" fill="#2d3748" />
                  <ellipse cx="235" cy="170" rx="15" ry="20" fill="#2d3748" />
                  <ellipse cx="170" cy="168" rx="6" ry="8" fill="white" />
                  <ellipse cx="240" cy="168" rx="6" ry="8" fill="white" />

                  <path
                    d="M200 185 L195 205 L205 205 Z"
                    fill="#e76f51"
                    opacity="0.5"
                  />

                  {isSpeaking ? (
                    <ellipse
                      cx="200"
                      cy="220"
                      rx="30"
                      ry="15"
                      fill="#2d3748"
                      opacity="0.8"
                    />
                  ) : (
                    <path
                      d="M180 220 Q200 230 220 220"
                      stroke="#2d3748"
                      strokeWidth="3"
                      fill="none"
                    />
                  )}

                  <path
                    d="M100 290 Q100 310 120 320 L200 380 L280 320 Q300 310 300 290 L300 280 L250 300 L200 290 L150 300 L100 280 Z"
                    fill="#4a5568"
                  />
                  <circle cx="200" cy="305" r="3" fill="white" />
                  <circle cx="200" cy="320" r="3" fill="white" />
                </svg>
              </div>

              {isSpeaking && (
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-accent text-accent-foreground px-4 py-2 rounded-full shadow-lg">
                  <div
                    className="w-2 h-2 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              )}
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-2xl font-semibold text-foreground">
                  Sarah Mitchell
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleMute}
                  className="h-8 w-8 rounded-full"
                  title={isMuted ? "Unmute voice" : "Mute voice"}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground">Senior Career Coach</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                15+ years helping professionals find their path and achieve
                their career goals
              </p>
            </div>

            <Button
              onClick={handleStartRecording}
              disabled={!isSpeechSupported}
              className={`px-8 py-3 text-base font-medium ${
                isRecording
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-5 h-5 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Start Recording
                </>
              )}
            </Button>

            {isRecording && (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-2 text-destructive">
                  <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Recording...</span>
                </div>
                {transcript && (
                  <div className="max-w-xs text-sm text-muted-foreground bg-muted px-4 py-2 rounded-lg">
                    {transcript}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col h-[600px]">
            <Card className="flex-1 flex flex-col shadow-xl overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col ${
                      message.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {message.role === "coach" && (
                        <p className="font-semibold text-sm mb-1 text-foreground">
                          Coach:
                        </p>
                      )}
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => (
                              <p className="mb-2 last:mb-0">{children}</p>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold">
                                {children}
                              </strong>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside mb-2 space-y-1">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-inside mb-2 space-y-1">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="ml-2">{children}</li>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      {message.role === "coach" &&
                        message.sources &&
                        message.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-xs font-semibold text-foreground mb-3">
                              Sources:
                            </p>
                            <div className="space-y-2">
                              {message.sources.map((source, idx) => {
                                const formatUpvotes = (
                                  score: number | undefined
                                ) => {
                                  if (!score) return null;
                                  if (score >= 1000) {
                                    return `${(score / 1000).toFixed(1)}k`;
                                  }
                                  return score.toString();
                                };

                                const formatDate = (
                                  dateStr: string | undefined
                                ) => {
                                  if (!dateStr) return null;
                                  try {
                                    const date = new Date(dateStr);
                                    return date.toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    });
                                  } catch {
                                    return dateStr;
                                  }
                                };

                                return (
                                  <a
                                    key={idx}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-2 p-2 rounded-lg bg-background/50 hover:bg-background/80 border border-border/30 hover:border-primary/30 transition-colors group"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0 group-hover:text-primary transition-colors" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {source.source && (
                                          <span className="text-xs font-medium text-foreground">
                                            reddit.com/r/{source.source}
                                          </span>
                                        )}
                                        {source.date && (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Calendar className="w-3 h-3" />
                                            <span>
                                              {formatDate(source.date)}
                                            </span>
                                          </div>
                                        )}
                                        {source.score && (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <ThumbsUp className="w-3 h-3" />
                                            <span>
                                              {formatUpvotes(source.score)}{" "}
                                              upvotes
                                            </span>
                                          </div>
                                        )}
                                        {source.num_comments && (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <MessageSquare className="w-3 h-3" />
                                            <span>
                                              {source.num_comments} comments
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 px-2">
                      {message.timestamp}
                    </span>
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

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setInputValue("How do I negotiate a better salary?")
                }
              >
                Salary Tips
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputValue("I want to change careers")}
              >
                Career Change
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setInputValue("Help me prepare for an interview")
                }
              >
                Interview Prep
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
