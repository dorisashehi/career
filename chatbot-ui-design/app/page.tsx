"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
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
import { Header } from "@/components/header";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastCoachMessageRef = useRef<HTMLDivElement>(null);
  const handleSendQuestionRef = useRef<
    ((question: string) => Promise<void>) | null
  >(null);
  const previousMessageCountRef = useRef<number>(0);
  const { toast } = useToast();
  const [showChat, setShowChat] = useState(false); // Track if chat should be visible
  const videoRef = useRef<HTMLVideoElement>(null);

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
    // Show chat after recording completes
    if (!showChat) {
      setShowChat(true);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToCoachMessage = () => {
    lastCoachMessageRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];

      // If the last message is from coach, scroll to the beginning of it
      if (lastMessage?.role === "coach") {
        const timeoutId = setTimeout(() => {
          scrollToCoachMessage();
        }, 100);
        previousMessageCountRef.current = messages.length;
        return () => clearTimeout(timeoutId);
      } else {
        // For user messages, scroll to bottom
        const timeoutId = setTimeout(() => {
          scrollToBottom();
        }, 100);
        previousMessageCountRef.current = messages.length;
        return () => clearTimeout(timeoutId);
      }
    }
  }, [messages.length]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage?.role === "coach" &&
      lastSpokenMessageIdRef.current !== lastMessage.id &&
      !isMuted &&
      !lastMessage.isError
    ) {
      stopSpeaking(true);
      lastSpokenMessageIdRef.current = lastMessage.id;
      speakText(lastMessage.content, lastMessage.id);
    }
  }, [messages, isMuted, speakText, stopSpeaking]);

  // Preload video on mount
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load(); // Preload the video
    }
  }, []);

  // Control video playback based on speaking state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isSpeaking) {
      // Ensure video is loaded before playing
      const playVideo = () => {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Video is playing
            })
            .catch((error) => {
              console.log("Video play error:", error);
              // Try again after a short delay
              setTimeout(() => {
                video.play().catch((e) => console.log("Retry play error:", e));
              }, 100);
            });
        }
      };

      if (video.readyState >= 2) {
        // HAVE_CURRENT_DATA or higher - video is ready
        playVideo();
      } else {
        // Wait for video to be ready
        const handleCanPlay = () => {
          playVideo();
          video.removeEventListener("canplay", handleCanPlay);
        };
        video.addEventListener("canplay", handleCanPlay);
        video.load(); // Ensure video loads

        return () => {
          video.removeEventListener("canplay", handleCanPlay);
        };
      }
    } else {
      video.pause();
      video.currentTime = 0; // Reset to first frame
    }
  }, [isSpeaking]);

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

    // Show chat when user sends first message
    if (!showChat) {
      setShowChat(true);
    }

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
      <Header showCareerResources={false} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:py-12">
        <div
          className={`${
            showChat ? "grid md:grid-cols-2 gap-8" : "flex justify-center"
          } items-start transition-all duration-700`}
        >
          <div
            className={`flex flex-col items-center justify-center space-y-6 transition-all duration-700 ${
              showChat ? "md:sticky md:top-8" : ""
            }`}
          >
            <div className="relative">
              <div className="relative w-64 h-64 md:w-80 md:h-80 overflow-hidden bg-background">
                {/* Video for speaking state */}
                <video
                  ref={videoRef}
                  src="/avatar/Short_Video_Generation_Request.mp4"
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 border-none ${
                    isSpeaking ? "opacity-100 scale-110" : "opacity-0 scale-100"
                  }`}
                  style={{
                    objectPosition: "center",
                    border: "none",
                    outline: "none",
                  }}
                  onLoadedData={() => {
                    // Video is loaded and ready
                    if (isSpeaking && videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.play().catch((e) => {
                        console.log("Video play error:", e);
                      });
                    }
                  }}
                />
                {/* Static image for non-speaking state */}
                <img
                  src="/avatar/avatar.png"
                  alt="Career Coach Avatar"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 border-none ${
                    isSpeaking ? "opacity-0 scale-110" : "opacity-100 scale-100"
                  }`}
                  style={{
                    objectPosition: "center",
                    border: "none",
                    outline: "none",
                  }}
                />
              </div>
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
                Your AI coach trained on real Reddit discussions and user
                experiences
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

          {showChat && (
            <div className="flex flex-col h-[600px] animate-slide-in-right">
              <Card className="flex-1 flex flex-col shadow-xl overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-center p-8">
                      <p className="text-lg">
                        Starting your career coaching session...
                      </p>
                    </div>
                  )}

                  {messages.map((message, index) => {
                    const isLastCoachMessage =
                      message.role === "coach" && index === messages.length - 1;

                    return (
                      <div
                        key={message.id}
                        ref={isLastCoachMessage ? lastCoachMessageRef : null}
                        className={`flex flex-col animate-slide-in ${
                          message.role === "user" ? "items-end" : "items-start"
                        }`}
                        style={{ animationDelay: `${index * 100}ms` }}
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
                                        return date.toLocaleDateString(
                                          "en-US",
                                          {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                          }
                                        );
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
                    );
                  })}

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
          )}
        </div>
      </main>
    </div>
  );
}
