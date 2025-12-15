"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
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

type Message = {
  id: string;
  role: "user" | "coach";
  content: string;
  timestamp: string;
  sources?: Source[];
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
  const [isSpeaking, setIsSpeaking] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const handleSendQuestionRef = useRef<
    ((question: string) => Promise<void>) | null
  >(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingActiveRef = useRef<boolean>(false);
  const previousMessageCountRef = useRef<number>(1);
  const { toast } = useToast();
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const isCancellingRef = useRef(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_SPEECH_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Store paused speech state for resuming
  const pausedSpeechRef = useRef<{
    chunks: string[];
    currentIndex: number;
    messageId: string;
  } | null>(null);

  // Track current speech state for saving when muting
  const currentSpeechRef = useRef<{
    chunks: string[];
    currentIndex: number;
    messageId: string | undefined;
  } | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll effect - only when message count changes (new message added)
  useEffect(() => {
    // Only scroll if a new message was actually added
    if (messages.length > previousMessageCountRef.current) {
      const timeoutId = setTimeout(() => {
        scrollToBottom();
      }, 100);

      previousMessageCountRef.current = messages.length;
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length]); // Only depend on length, not the whole array

  // Initialize speech recognition on mount
  useEffect(() => {
    // Check for browser support
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      // When we get speech results (what the user said)
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let temporaryText = ""; // Text that might change as user speaks
        let finalText = ""; // Text that's confirmed (user finished saying it)

        // Go through all the speech results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            // This is the final, confirmed text
            finalText += text + " ";
          } else {
            // This is temporary text that might change
            temporaryText += text;
          }
        }

        // If we have final text, save it
        if (finalText) {
          const cleanedText = finalText.trim();
          finalTranscriptRef.current = cleanedText; // Save for later
          setTranscript(cleanedText); // Show it on screen
        } else {
          // Otherwise show the temporary text
          setTranscript(temporaryText);
        }
      };

      // When there's an error with speech recognition
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsRecording(false); // Stop recording
        setTranscript(""); // Clear any text

        // Figure out what went wrong and show a helpful message
        let errorMessage = "Something went wrong with speech recognition.";
        if (event.error === "no-speech") {
          errorMessage = "No speech detected. Please try again.";
        } else if (event.error === "audio-capture") {
          errorMessage = "No microphone found. Please check your microphone.";
        } else if (event.error === "not-allowed") {
          errorMessage =
            "Microphone permission denied. Please allow microphone access.";
        } else if (event.error === "network") {
          errorMessage = "Network error. Please check your connection.";
        }

        // Show the error to the user
        toast({
          title: "Recording Error",
          description: errorMessage,
          variant: "destructive",
        });
      };

      // When recording stops
      recognition.onend = () => {
        setIsRecording(false); // Mark that we're no longer recording

        // If we got some text, send it to the API
        const finalText = finalTranscriptRef.current.trim();
        if (finalText && handleSendQuestionRef.current) {
          // Wait a tiny bit, then send the question to get an answer
          setTimeout(() => {
            handleSendQuestionRef.current?.(finalText);
            finalTranscriptRef.current = ""; // Clear it
            setTranscript(""); // Clear it from screen
          }, 100);
        } else {
          setTranscript(""); // Clear any text
        }
      };

      recognitionRef.current = recognition;
    } else {
      setIsSpeechSupported(false);
      toast({
        title: "Speech Recognition Not Supported",
        description:
          "Your browser doesn't support speech recognition. Please use the text input instead.",
        variant: "default",
      });
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Helper function to set up utterance event handlers
  const setupUtterance = (
    utterance: SpeechSynthesisUtterance,
    isLastChunk: boolean = true
  ) => {
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      isSpeakingActiveRef.current = true;
    };

    utterance.onend = () => {
      if (isLastChunk) {
        setIsSpeaking(false);
        isSpeakingActiveRef.current = false;
        speechSynthesisRef.current = null;
      }
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setIsSpeaking(false);
      isSpeakingActiveRef.current = false;
      speechSynthesisRef.current = null;
    };
  };

  // Helper function to speak text chunks sequentially
  const speakChunks = (chunks: string[], index: number, messageId?: string) => {
    // Update current speech state
    currentSpeechRef.current = {
      chunks,
      currentIndex: index,
      messageId,
    };

    // Pause if muted (check ref for latest value) - save state for resuming
    if (isMutedRef.current) {
      // Save the paused state so we can resume later
      if (messageId) {
        pausedSpeechRef.current = {
          chunks,
          currentIndex: index,
          messageId,
        };
      }
      // Cancel current speech but don't clear the state
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      isSpeakingActiveRef.current = false;
      speechSynthesisRef.current = null;
      return;
    }

    if (index >= chunks.length) {
      // All chunks done
      setIsSpeaking(false);
      isSpeakingActiveRef.current = false;
      speechSynthesisRef.current = null;
      currentSpeechRef.current = null;
      pausedSpeechRef.current = null;
      // Clear timeout when done
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    const isLastChunk = index === chunks.length - 1;
    setupUtterance(utterance, isLastChunk);

    utterance.onend = () => {
      // Stop if muted before speaking next chunk (check ref for latest value)
      if (isMutedRef.current) {
        stopSpeaking();
        return;
      }

      // Speak next chunk immediately after the previous one finishes
      if (!isLastChunk) {
        // Use a small delay to ensure the previous utterance is fully cleared
        setTimeout(() => {
          // Pass messageId if available (check if it's in the closure or get from pausedSpeechRef)
          const msgId =
            pausedSpeechRef.current?.messageId ||
            lastSpokenMessageIdRef.current;
          speakChunks(chunks, index + 1, msgId || undefined);
        }, 50);
      } else {
        setIsSpeaking(false);
        isSpeakingActiveRef.current = false;
        speechSynthesisRef.current = null;
        currentSpeechRef.current = null;
        pausedSpeechRef.current = null;
        // Clear timeout when done
        if (speechTimeoutRef.current) {
          clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = null;
        }
      }
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      // Try to continue with the next chunk even if there's an error
      if (!isLastChunk) {
        setTimeout(() => {
          const msgId =
            pausedSpeechRef.current?.messageId ||
            lastSpokenMessageIdRef.current;
          speakChunks(chunks, index + 1, msgId || undefined);
        }, 50);
      } else {
        setIsSpeaking(false);
        isSpeakingActiveRef.current = false;
        speechSynthesisRef.current = null;
        currentSpeechRef.current = null;
        pausedSpeechRef.current = null;
        // Clear timeout when done
        if (speechTimeoutRef.current) {
          clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = null;
        }
      }
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Function to speak text using text-to-speech with timeout and chunking
  const speakText = (text: string, messageId?: string) => {
    if (!("speechSynthesis" in window)) return;
    // Don't speak if muted (check ref for latest value)
    if (isMutedRef.current) {
      // If muted, still prepare the chunks and save them for when unmuted
      const chunkSize = 200;
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks: string[] = [];
      let currentChunk = "";

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= chunkSize) {
          currentChunk += sentence;
        } else {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = sentence;
        }
      }
      if (currentChunk) chunks.push(currentChunk.trim());

      if (chunks.length === 0) {
        chunks.push(text);
      }

      if (messageId) {
        pausedSpeechRef.current = {
          chunks,
          currentIndex: 0,
          messageId,
        };
      }
      return;
    }

    // HARD STOP everything
    window.speechSynthesis.cancel();
    isCancellingRef.current = false;

    // Clear any existing timeout
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }

    // Split text into chunks (max 200 characters per chunk to avoid browser limits)
    const chunkSize = 200;
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= chunkSize) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    // If no chunks, use the original text
    if (chunks.length === 0) {
      chunks.push(text);
    }

    // Set a maximum duration timeout
    speechTimeoutRef.current = setTimeout(() => {
      stopSpeaking();
      toast({
        title: "Speech Timeout",
        description: "Speech stopped after maximum duration.",
        variant: "default",
      });
    }, MAX_SPEECH_DURATION);

    // Speak chunks sequentially
    speakChunks(chunks, 0, messageId);
  };

  // Stop speaking
  const stopSpeaking = (clearPaused = false) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    isSpeakingActiveRef.current = false;
    speechSynthesisRef.current = null;
    // Clear timeout when stopping
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    // Clear paused speech if requested (e.g., when starting new speech)
    if (clearPaused) {
      pausedSpeechRef.current = null;
      currentSpeechRef.current = null;
    }
  };

  // Auto-speak when coach messages arrive
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage?.role === "coach" &&
      lastMessage.id !== "1" &&
      lastSpokenMessageIdRef.current !== lastMessage.id &&
      !isMuted
    ) {
      stopSpeaking(true); // ensure clean start and clear any paused speech
      lastSpokenMessageIdRef.current = lastMessage.id;
      speakText(lastMessage.content, lastMessage.id);
    }
  }, [messages, isMuted]);

  // Toggle mute/unmute
  const handleToggleMute = () => {
    const newMuted = !isMuted;

    // Update ref immediately so speakChunks can check it
    isMutedRef.current = newMuted;

    setIsMuted(newMuted);

    // If we're muting and currently speaking, pause the speech and save state
    if (newMuted && isSpeaking && currentSpeechRef.current) {
      // Save the current speech state for resuming
      const current = currentSpeechRef.current;
      if (current.messageId) {
        pausedSpeechRef.current = {
          chunks: current.chunks,
          currentIndex: current.currentIndex,
          messageId: current.messageId,
        };
      }
      // Cancel current speech
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      isSpeakingActiveRef.current = false;
      speechSynthesisRef.current = null;
    }
    // If we're unmuting and there's paused speech, resume it
    else if (!newMuted && pausedSpeechRef.current) {
      const paused = pausedSpeechRef.current;
      // Resume from where we left off
      setTimeout(() => {
        // Set a maximum duration timeout for the resumed speech
        speechTimeoutRef.current = setTimeout(() => {
          stopSpeaking(true);
          toast({
            title: "Speech Timeout",
            description: "Speech stopped after maximum duration.",
            variant: "default",
          });
        }, MAX_SPEECH_DURATION);

        // Resume speaking from the paused position
        setIsSpeaking(true);
        isSpeakingActiveRef.current = true;
        speakChunks(paused.chunks, paused.currentIndex, paused.messageId);
      }, 100);
    }
  };

  // Cleanup effect that stops speech on page reload/unload
  useEffect(() => {
    const stopSpeech = () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      isSpeakingActiveRef.current = false;
      speechSynthesisRef.current = null;
      // Clear timeout
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
    };

    // Stop speech on page reload/unload
    window.addEventListener("beforeunload", stopSpeech);
    window.addEventListener("unload", stopSpeech);
    window.addEventListener("pagehide", stopSpeech);

    // Stop speech when page becomes hidden (e.g., tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopSpeech();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", stopSpeech);
      window.removeEventListener("unload", stopSpeech);
      window.removeEventListener("pagehide", stopSpeech);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Also stop on component unmount
      stopSpeech();
    };
  }, []);

  // Removed scroll listener that was stopping speech on manual scroll
  // Speech will now continue even when user scrolls the chat messages
  // Convert our messages to the format the API expects
  // The API uses "assistant" but we use "coach" in the UI
  const convertMessagesToApiFormat = (msgs: Message[]): ApiChatMessage[] => {
    // Skip the first welcome message (it has id "1")
    const messagesToSend = msgs.filter((msg) => msg.id !== "1");

    // Convert "coach" to "assistant" for the API
    return messagesToSend.map((msg) => ({
      role: msg.role === "coach" ? "assistant" : "user",
      content: msg.content,
    }));
  };

  // This function sends a question to the backend and shows the response
  const handleSendQuestion = async (question: string) => {
    // Don't send empty questions
    if (!question.trim()) return;

    // Stop any current speech
    stopSpeaking();

    // Create a message object for the user's question
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question.trim(),
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };

    // Add the user's message to the chat
    setMessages((prev) => [...prev, userMessage]);

    // Show that we're waiting for a response
    setIsTyping(true);

    try {
      // Get all previous messages (including the one we just added)
      const allMessages = [...messages, userMessage];

      // Convert them to the format the API wants
      const chatHistory = convertMessagesToApiFormat(allMessages);

      // Call the API to get an answer and sources
      const response = await askQuestion(question.trim(), chatHistory);

      // Create a message object for the coach's response
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

      // Stop showing the typing indicator
      setIsTyping(false);

      // Add the coach's response to the chat
      setMessages((prev) => [...prev, coachMessage]);
    } catch (error) {
      // If something went wrong, stop the typing indicator
      setIsTyping(false);

      // Get the error message
      let errorMessage = "Something went wrong. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Show the error to the user
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Also add an error message in the chat
      const errorChatMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content:
          "I'm sorry, I encountered an error. Please try again or check your connection.",
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorChatMessage]);
    }
  };

  // Store the function reference for use in speech recognition
  // Use useCallback to prevent this from changing on every render
  const handleSendQuestionStable = useRef(handleSendQuestion);

  useEffect(() => {
    handleSendQuestionStable.current = handleSendQuestion;
  });

  useEffect(() => {
    handleSendQuestionRef.current = handleSendQuestionStable.current;
  }, []);

  // Handle text input submission
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

  // Handle the record button click
  const handleStartRecording = () => {
    // Check if speech recognition is supported
    if (!isSpeechSupported) {
      toast({
        title: "Not Supported",
        description:
          "Speech recognition is not supported in your browser. Please use the text input.",
        variant: "default",
      });
      return;
    }

    if (!isRecording) {
      // Start recording
      stopSpeaking(); // Stop any current speech
      setTranscript(""); // Clear any old text
      setIsRecording(true); // Mark that we're recording

      try {
        // Start the speech recognition
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (error) {
        // If starting failed, stop recording and show an error
        setIsRecording(false);
        toast({
          title: "Recording Error",
          description: "Failed to start recording. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // Stop recording
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
  };

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
                className={`relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden bg-gradient-to-br from-accent to-accent/70 shadow-2xl transition-transform duration-300 ${
                  isSpeaking ? "animate-speak" : ""
                }`}
              >
                <svg viewBox="0 0 400 400" className="w-full h-full">
                  {/* Head */}
                  <ellipse cx="200" cy="180" rx="100" ry="120" fill="#f4a261" />

                  {/* Hair */}
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

                  {/* Eyes */}
                  <ellipse cx="165" cy="170" rx="15" ry="20" fill="#2d3748" />
                  <ellipse cx="235" cy="170" rx="15" ry="20" fill="#2d3748" />
                  <ellipse cx="170" cy="168" rx="6" ry="8" fill="white" />
                  <ellipse cx="240" cy="168" rx="6" ry="8" fill="white" />

                  {/* Nose */}
                  <path
                    d="M200 185 L195 205 L205 205 Z"
                    fill="#e76f51"
                    opacity="0.5"
                  />

                  {/* Mouth - changes based on speaking */}
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

            {/* Start Recording button */}
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

            {/* Recording indicator with transcript */}
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

          {/* Chat Section */}
          <div className="flex flex-col h-[600px]">
            <Card className="flex-1 flex flex-col shadow-xl overflow-hidden">
              {/* Messages */}
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
                      <p className="text-sm leading-relaxed">
                        {message.content}
                      </p>
                      {message.role === "coach" &&
                        message.sources &&
                        message.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-xs font-semibold text-foreground mb-3">
                              Sources:
                            </p>
                            <div className="space-y-2">
                              {message.sources.map((source, idx) => {
                                // Format upvotes (e.g., 8290 -> 8.3k)
                                const formatUpvotes = (
                                  score: number | undefined
                                ) => {
                                  if (!score) return null;
                                  if (score >= 1000) {
                                    return `${(score / 1000).toFixed(1)}k`;
                                  }
                                  return score.toString();
                                };

                                // Format date (e.g., 2025-05-01 -> May 1, 2025)
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
