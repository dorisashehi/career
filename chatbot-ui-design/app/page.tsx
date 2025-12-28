"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/router";
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
  const [showChat, setShowChat] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    isSpeaking,
    isRecording,
    transcript,
    isSpeechSupported,
    isMuted,
    isLoadingAudio,
    speakText,
    stopSpeaking,
    preloadAudio,
    handleToggleMute,
    handleStartRecording,
    lastSpokenMessageIdRef,
  } = useSpeech((text: string) => {
    if (handleSendQuestionRef.current) {
      handleSendQuestionRef.current(text);
    }
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

      if (lastMessage?.role === "coach") {
        const timeoutId = setTimeout(() => {
          scrollToCoachMessage();
        }, 100);
        previousMessageCountRef.current = messages.length;
        return () => clearTimeout(timeoutId);
      } else {
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
      // If audio was preloaded while muted, speakText will use it
      // Otherwise, it will load and play
      speakText(lastMessage.content, lastMessage.id);
    }
  }, [messages, isMuted, speakText, stopSpeaking]);

  useEffect(() => {
    stopSpeaking();
  }, [stopSpeaking]);

  // Sync isTyping with isLoadingAudio
  useEffect(() => {
    if (isLoadingAudio) {
      setIsTyping(true);
    }
    // When isLoadingAudio becomes false, keep isTyping true (don't auto-stop)
    // It will be manually stopped when message is shown
  }, [isLoadingAudio]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isSpeaking) {
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
              setTimeout(() => {
                video.play().catch((e) => console.log("Retry play error:", e));
              }, 100);
            });
        }
      };

      if (video.readyState >= 2) {
        playVideo();
      } else {
        const handleCanPlay = () => {
          playVideo();
          video.removeEventListener("canplay", handleCanPlay);
        };
        video.addEventListener("canplay", handleCanPlay);
        video.load();

        return () => {
          video.removeEventListener("canplay", handleCanPlay);
        };
      }
    } else {
      video.pause();
      video.currentTime = 0;
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

      const messageId = (Date.now() + 1).toString();
      const coachMessage: Message = {
        id: messageId,
        role: "coach",
        content: response.answer,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        sources: response.sources || [],
      };

      // Keep typing indicator until audio is ready
      // Always try to preload audio (even if muted, so it's ready when unmuted)
      // preloadAudio will handle muted state internally
      try {
        // Preload audio - this will set isLoadingAudio to true if not muted
        // If muted, preloadAudio stores text in pausedRef for later
        await preloadAudio(response.answer, messageId);
      } catch (audioError) {
        // If audio loading fails, log but continue to show message
        console.error("Audio preload error:", audioError);
      }

      // Stop typing indicator after preload attempt
      setIsTyping(false);

      // Now show the message - audio is ready to play immediately (or will be when unmuted)
      setMessages((prev) => [...prev, coachMessage]);

      // Start speaking immediately after message is shown (if not muted and audio loaded successfully)
      if (!isMuted && !coachMessage.isError) {
        stopSpeaking(true);
        lastSpokenMessageIdRef.current = messageId;
        speakText(response.answer, messageId);
      }
      // If muted, the text is stored in pausedRef by preloadAudio
      // When user unmutes, the useEffect will trigger speakText for the latest message
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
    <div className="min-h-screen bg-background flex flex-col overflow-y-auto">
      <div className="animate-fade-in">
        <Header showCareerResources={true} />
      </div>

      <main
        className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:py-12 animate-page-entrance"
        style={{ animationDelay: "0.1s" }}
      >
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
                    isSpeaking ? "opacity-100 scale-100" : "opacity-0 scale-100"
                  }`}
                  style={{
                    objectPosition: "center",
                    border: "none",
                    outline: "none",
                  }}
                  onLoadedData={() => {
                    if (isSpeaking && videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.play().catch((e) => {
                        console.log("Video play error:", e);
                      });
                    }
                  }}
                />
                {/* Video for non-speaking state */}
                <video
                  src="/avatar/avatar.mp4"
                  loop
                  muted
                  autoPlay
                  playsInline
                  preload="auto"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 border-none ${
                    isSpeaking ? "opacity-0 scale-100" : "opacity-100 scale-100"
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
                  Ella - Tech Career Advisor
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
              <p
                className="text-sm text-muted-foreground leading-relaxed"
                style={{ maxWidth: "600px" }}
              >
                When your career path hits a 404, I help you find it. I've
                learned from thousands of real developer stories, interviews
                gone wrong, salary wins, career pivots, and skill upgrades, from
                Reddit and real users like you.
              </p>
            </div>

            <Button
              onClick={handleStartRecording}
              disabled={!isSpeechSupported}
              className={`px-8 py-3 text-base font-medium smooth-hover transition-all duration-200 ${
                isRecording
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse-glow"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:scale-105 active:scale-95"
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
                        className={`flex flex-col animate-fade-in smooth-hover ${
                          message.role === "user" ? "items-end" : "items-start"
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 transition-all duration-200 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground shadow-sm hover:shadow-md"
                              : "bg-muted text-muted-foreground shadow-sm hover:shadow-md border border-border/30"
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
                                        className="flex items-start gap-2 p-2 rounded-lg bg-background/50 hover:bg-background/80 border border-border/30 hover:border-primary/50 smooth-hover shadow-sm hover:shadow-md transition-all duration-200 group"
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

                  {(isTyping || isLoadingAudio) && (
                    <div className="flex items-start animate-fade-in">
                      <div className="bg-muted rounded-2xl px-4 py-3 shadow-sm border border-border/30">
                        <div className="flex gap-1">
                          <div
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <div
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <div
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
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
                  className="border-border/50 hover:border-primary/50 hover:bg-primary/5 smooth-hover shadow-sm hover:shadow-md transition-all duration-200"
                >
                  Salary Tips
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInputValue("I want to change careers")}
                  className="border-border/50 hover:border-primary/50 hover:bg-primary/5 smooth-hover shadow-sm hover:shadow-md transition-all duration-200"
                >
                  Career Change
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setInputValue("Help me prepare for an interview")
                  }
                  className="border-border/50 hover:border-primary/50 hover:bg-primary/5 smooth-hover shadow-sm hover:shadow-md transition-all duration-200"
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
