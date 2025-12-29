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
  const [forceShowMessages, setForceShowMessages] = useState<Set<string>>(
    new Set()
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastCoachMessageRef = useRef<HTMLDivElement>(null);
  const handleSendQuestionRef = useRef<
    ((question: string) => Promise<void>) | null
  >(null);
  const previousMessageCountRef = useRef<number>(0);
  const previousLoadingAudioRef = useRef<boolean>(false);
  const messageAudioTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
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

  /**
   * Scrolls the chat container to the bottom of the messages list.
   * Uses smooth scrolling behavior for a better user experience.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * Scrolls the chat container to the last coach message.
   * Positions the message at the start of the viewport for better visibility.
   */
  const scrollToCoachMessage = () => {
    lastCoachMessageRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  /**
   * Handles automatic scrolling when new messages are added.
   * - User messages: Scrolls to bottom immediately since they're always visible
   * - Coach messages: Scrolls to loader if audio is loading, or to message if already visible
   *
   * @effect Triggers when messages.length or isLoadingAudio changes
   */
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];

      if (lastMessage?.role === "user") {
        const timeoutId = setTimeout(() => {
          scrollToBottom();
        }, 100);
        previousMessageCountRef.current = messages.length;
        return () => clearTimeout(timeoutId);
      } else if (lastMessage?.role === "coach") {
        const timeoutId = setTimeout(() => {
          if (isLoadingAudio) {
            scrollToBottom();
          } else {
            scrollToCoachMessage();
          }
        }, 100);
        previousMessageCountRef.current = messages.length;
        return () => clearTimeout(timeoutId);
      }
    }
  }, [messages.length, isLoadingAudio]);

  /**
   * Scrolls to coach message when it becomes visible after audio loading completes.
   * Only triggers when isLoadingAudio transitions from true to false.
   * Also cleans up any pending timeout for the message since it's now visible.
   *
   * @effect Triggers when isLoadingAudio or messages change
   */
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === "coach" &&
      previousLoadingAudioRef.current === true &&
      !isLoadingAudio
    ) {
      const timeoutId = setTimeout(() => {
        scrollToCoachMessage();
      }, 150);

      if (
        lastMessage.id &&
        messageAudioTimeoutRef.current.has(lastMessage.id)
      ) {
        const pendingTimeout = messageAudioTimeoutRef.current.get(
          lastMessage.id
        );
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          messageAudioTimeoutRef.current.delete(lastMessage.id);
        }
      }

      previousLoadingAudioRef.current = isLoadingAudio;
      return () => clearTimeout(timeoutId);
    }
    previousLoadingAudioRef.current = isLoadingAudio;
  }, [isLoadingAudio, messages]);

  /**
   * Automatically speaks coach messages when they appear and user is not muted.
   * Prevents re-speaking the same message by checking lastSpokenMessageIdRef.
   * Skips error messages and respects the mute state.
   *
   * @effect Triggers when messages, isMuted, speakText, or stopSpeaking change
   */
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

  /**
   * Stops any ongoing speech when the component unmounts.
   * Ensures audio doesn't continue playing after the user navigates away.
   *
   * @effect Runs on component unmount
   */
  useEffect(() => {
    stopSpeaking();
  }, [stopSpeaking]);

  /**
   * Cleans up all pending audio timeout references when component unmounts.
   * Prevents memory leaks by clearing all scheduled timeouts.
   *
   * @effect Runs on component unmount
   */
  useEffect(() => {
    return () => {
      messageAudioTimeoutRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      messageAudioTimeoutRef.current.clear();
    };
  }, []);

  /**
   * Synchronizes the typing indicator with audio loading state.
   * Shows typing indicator when audio is loading.
   * Note: Doesn't auto-hide when loading completes - that's handled manually when message is shown.
   *
   * @effect Triggers when isLoadingAudio changes
   */
  useEffect(() => {
    if (isLoadingAudio) {
      setIsTyping(true);
    }
  }, [isLoadingAudio]);

  /**
   * Loads the avatar video element when the component mounts.
   * Ensures the video is ready for playback when needed.
   *
   * @effect Runs once on component mount
   */
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  }, []);

  /**
   * Controls avatar video playback based on speaking state.
   * - When speaking: Plays the speaking animation video from the beginning
   * - When not speaking: Pauses and resets the video
   * Handles video loading states and retries on play errors.
   *
   * @effect Triggers when isSpeaking state changes
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isSpeaking) {
      const playVideo = () => {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {})
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

  /**
   * Converts internal message format to API-compatible format.
   * Filters out messages with id "1" and maps role names (coach -> assistant).
   *
   * @param msgs - Array of internal Message objects
   * @returns Array of ApiChatMessage objects ready for API submission
   */
  const convertMessagesToApiFormat = (msgs: Message[]): ApiChatMessage[] => {
    const messagesToSend = msgs.filter((msg) => msg.id !== "1");

    return messagesToSend.map((msg) => ({
      role: msg.role === "coach" ? "assistant" : "user",
      content: msg.content,
    }));
  };

  /**
   * Handles sending a user question to the API and processing the coach's response.
   * - Creates and displays user message immediately
   * - Sends question to API with chat history
   * - Preloads audio for the coach's response
   * - Displays coach message (hidden until audio loads or fails)
   * - Handles errors gracefully with user-friendly messages
   * - Sets up timeout fallback to ensure message shows even if audio is slow
   *
   * @param question - The user's question text
   * @throws Logs errors and shows toast notifications, but doesn't throw
   */
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

      try {
        await preloadAudio(response.answer, messageId);
      } catch (audioError) {
        console.error("Audio preload error:", audioError);
        setForceShowMessages((prev) => new Set(prev).add(messageId));
      }

      setIsTyping(false);

      setMessages((prev) => [...prev, coachMessage]);

      const timeoutId = setTimeout(() => {
        setForceShowMessages((prev) => new Set(prev).add(messageId));
        messageAudioTimeoutRef.current.delete(messageId);
      }, 5000);
      messageAudioTimeoutRef.current.set(messageId, timeoutId);

      if (!isMuted && !coachMessage.isError) {
        stopSpeaking(true);
        lastSpokenMessageIdRef.current = messageId;
        speakText(response.answer, messageId);
      }
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

  /**
   * Keeps the stable ref updated with the latest handleSendQuestion function.
   * This allows the speech hook callback to always use the current function.
   *
   * @effect Runs on every render to keep ref in sync
   */
  useEffect(() => {
    handleSendQuestionStable.current = handleSendQuestion;
  });

  /**
   * Sets up the handleSendQuestionRef for the speech hook callback.
   * This enables voice transcription to trigger question sending.
   *
   * @effect Runs once on component mount
   */
  useEffect(() => {
    handleSendQuestionRef.current = handleSendQuestionStable.current;
  }, []);

  /**
   * Handles sending a message from the input field.
   * Validates that the input is not empty, sends the question, and clears the input.
   */
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    handleSendQuestion(inputValue);
    setInputValue("");
  };

  /**
   * Handles keyboard input in the message input field.
   * Sends message on Enter key press (but allows Shift+Enter for new lines).
   *
   * @param e - Keyboard event from the input element
   */
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
                    const isLastMessage = index === messages.length - 1;
                    const shouldHideCoachMessage =
                      message.role === "coach" &&
                      isLastMessage &&
                      isLoadingAudio &&
                      !forceShowMessages.has(message.id);

                    if (shouldHideCoachMessage) {
                      return null;
                    }

                    return (
                      <div
                        key={message.id}
                        ref={isLastMessage ? lastCoachMessageRef : null}
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
                                    /**
                                     * Formats upvote scores for display.
                                     * Converts large numbers to abbreviated format (e.g., 1500 -> "1.5k").
                                     *
                                     * @param score - The upvote score to format
                                     * @returns Formatted score string or null if score is undefined
                                     */
                                    const formatUpvotes = (
                                      score: number | undefined
                                    ) => {
                                      if (!score) return null;
                                      if (score >= 1000) {
                                        return `${(score / 1000).toFixed(1)}k`;
                                      }
                                      return score.toString();
                                    };

                                    /**
                                     * Formats date strings for display in source links.
                                     * Converts ISO date strings to readable format (e.g., "Jan 15, 2024").
                                     * Falls back to original string if parsing fails.
                                     *
                                     * @param dateStr - ISO date string to format
                                     * @returns Formatted date string, original string, or null
                                     */
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

                  {isLoadingAudio && (
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
