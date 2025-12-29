"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/header";
import { askQuestion, type ChatMessage as ApiChatMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSpeech } from "@/hooks/use-speech";
import {
  AvatarSection,
  ChatMessagesList,
  ChatInput,
  QuickActionButtons,
  type Message,
} from "@/components/chat";

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
            className={`transition-all duration-700 ${
              showChat ? "md:sticky md:top-8" : ""
            }`}
          >
            <AvatarSection
              isSpeaking={isSpeaking}
              isRecording={isRecording}
              transcript={transcript}
              isSpeechSupported={isSpeechSupported}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              onStartRecording={handleStartRecording}
            />
          </div>

          {showChat && (
            <div className="flex flex-col h-[600px] animate-slide-in-right">
              <Card className="flex-1 flex flex-col shadow-xl overflow-hidden">
                <ChatMessagesList
                  messages={messages}
                  isLoadingAudio={isLoadingAudio}
                  forceShowMessages={forceShowMessages}
                  messagesEndRef={messagesEndRef}
                  lastCoachMessageRef={lastCoachMessageRef}
                />
                <ChatInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSendMessage}
                  onKeyPress={handleKeyPress}
                />
              </Card>
              <QuickActionButtons onSelect={setInputValue} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
