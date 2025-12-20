"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const MAX_SPEECH_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export function useSpeech(onTranscriptComplete?: (text: string) => void) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();

  // Refs for speech recognition
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const isMutedRef = useRef(false);
  const onTranscriptCompleteRef = useRef(onTranscriptComplete);

  // Refs for speech synthesis
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingActiveRef = useRef<boolean>(false);
  const isCancellingRef = useRef(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);

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

  // Keep refs in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    onTranscriptCompleteRef.current = onTranscriptComplete;
  }, [onTranscriptComplete]);

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

        // If we got some text, send it to the callback
        const finalText = finalTranscriptRef.current.trim();
        if (finalText && onTranscriptCompleteRef.current) {
          // Wait a tiny bit, then send the question to get an answer
          setTimeout(() => {
            onTranscriptCompleteRef.current?.(finalText);
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
  const speakChunks = useCallback(
    (chunks: string[], index: number, messageId?: string) => {
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
    },
    []
  );

  // Function to speak text using text-to-speech with timeout and chunking
  const speakText = useCallback(
    (text: string, messageId?: string) => {
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
    },
    [speakChunks, toast]
  );

  // Stop speaking
  const stopSpeaking = useCallback((clearPaused = false) => {
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
  }, []);

  // Toggle mute/unmute
  const handleToggleMute = useCallback(() => {
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
  }, [isMuted, isSpeaking, speakChunks, stopSpeaking, toast]);

  // Handle the record button click
  const handleStartRecording = useCallback(() => {
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
  }, [isSpeechSupported, isRecording, stopSpeaking, toast]);

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

  return {
    // State
    isSpeaking,
    isRecording,
    transcript,
    isSpeechSupported,
    isMuted,
    // Functions
    speakText,
    stopSpeaking,
    handleToggleMute,
    handleStartRecording,
    // Internal refs for message tracking (used by page component)
    lastSpokenMessageIdRef,
  };
}
