"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Home, Search, Briefcase, Menu, Send, Mic, MicOff } from "lucide-react";
import { askQuestion, type ChatMessage as ApiChatMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  role: "user" | "coach";
  content: string;
  timestamp: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const handleSendQuestionRef = useRef<
    ((question: string) => Promise<void>) | null
  >(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // Auto-speaking animation when coach messages arrive
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "coach") {
      setIsSpeaking(true);
      // Stop speaking after message "finishes"
      const timer = setTimeout(() => {
        setIsSpeaking(false);
      }, lastMessage.content.length * 50);
      return () => clearTimeout(timer);
    }
  }, [messages]);

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

    // Stop the coach from "speaking" animation
    setIsSpeaking(false);

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

      // Call the API to get an answer
      const answer = await askQuestion(question.trim(), chatHistory);

      // Create a message object for the coach's response
      const coachMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content: answer,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
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
  useEffect(() => {
    handleSendQuestionRef.current = handleSendQuestion;
  }, [messages]);

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
      setIsSpeaking(false); // Stop the coach animation
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
              <h2 className="text-2xl font-semibold text-foreground">
                Sarah Mitchell
              </h2>
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
