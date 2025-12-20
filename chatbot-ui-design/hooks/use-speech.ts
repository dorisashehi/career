"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const MAX_SPEECH_TIME = 5 * 60 * 1000;

export function useSpeech(onTranscriptComplete?: (text: string) => void) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const isMutedRef = useRef(false);
  const callbackRef = useRef(onTranscriptComplete);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const pausedRef = useRef<{
    chunks: string[];
    index: number;
    messageId: string;
  } | null>(null);
  const currentRef = useRef<{
    chunks: string[];
    index: number;
    messageId?: string;
  } | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    callbackRef.current = onTranscriptComplete;
  }, [onTranscriptComplete]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let tempText = "";
        let finalText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += text + " ";
          } else {
            tempText += text;
          }
        }

        if (finalText) {
          const cleaned = finalText.trim();
          finalTranscriptRef.current = cleaned;
          setTranscript(cleaned);
        } else {
          setTranscript(tempText);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsRecording(false);
        setTranscript("");

        let errorMsg = "Something went wrong with speech recognition.";
        if (event.error === "no-speech") {
          errorMsg = "No speech detected. Please try again.";
        } else if (event.error === "audio-capture") {
          errorMsg = "No microphone found. Please check your microphone.";
        } else if (event.error === "not-allowed") {
          errorMsg =
            "Microphone permission denied. Please allow microphone access.";
        } else if (event.error === "network") {
          errorMsg = "Network error. Please check your connection.";
        }

        toast({
          title: "Recording Error",
          description: errorMsg,
          variant: "destructive",
        });
      };

      recognition.onend = () => {
        setIsRecording(false);
        const finalText = finalTranscriptRef.current.trim();
        if (finalText && callbackRef.current) {
          setTimeout(() => {
            callbackRef.current?.(finalText);
            finalTranscriptRef.current = "";
            setTranscript("");
          }, 100);
        } else {
          setTranscript("");
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
  }, [toast]);

  const setupUtterance = (
    utterance: SpeechSynthesisUtterance,
    isLast: boolean = true
  ) => {
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      if (isLast) {
        setIsSpeaking(false);
        speechRef.current = null;
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      speechRef.current = null;
    };
  };

  const speakChunks = useCallback(
    (chunks: string[], index: number, messageId?: string) => {
      currentRef.current = {
        chunks,
        index,
        messageId,
      };

      if (isMutedRef.current) {
        if (messageId) {
          pausedRef.current = {
            chunks,
            index,
            messageId,
          };
        }
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
        speechRef.current = null;
        return;
      }

      if (index >= chunks.length) {
        setIsSpeaking(false);
        speechRef.current = null;
        currentRef.current = null;
        pausedRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      const isLast = index === chunks.length - 1;
      setupUtterance(utterance, isLast);

      utterance.onend = () => {
        if (isMutedRef.current) {
          stopSpeaking();
          return;
        }

        if (!isLast) {
          setTimeout(() => {
            const msgId =
              pausedRef.current?.messageId || lastMessageIdRef.current;
            speakChunks(chunks, index + 1, msgId || undefined);
          }, 50);
        } else {
          setIsSpeaking(false);
          speechRef.current = null;
          currentRef.current = null;
          pausedRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      };

      utterance.onerror = () => {
        if (!isLast) {
          setTimeout(() => {
            const msgId =
              pausedRef.current?.messageId || lastMessageIdRef.current;
            speakChunks(chunks, index + 1, msgId || undefined);
          }, 50);
        } else {
          setIsSpeaking(false);
          speechRef.current = null;
          currentRef.current = null;
          pausedRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      };

      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const speakText = useCallback(
    (text: string, messageId?: string) => {
      if (!("speechSynthesis" in window)) return;

      if (isMutedRef.current) {
        const chunkSize = 200;
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const chunks: string[] = [];
        let current = "";

        for (const sentence of sentences) {
          if ((current + sentence).length <= chunkSize) {
            current += sentence;
          } else {
            if (current) chunks.push(current.trim());
            current = sentence;
          }
        }
        if (current) chunks.push(current.trim());
        if (chunks.length === 0) chunks.push(text);

        if (messageId) {
          pausedRef.current = {
            chunks,
            index: 0,
            messageId,
          };
        }
        return;
      }

      window.speechSynthesis.cancel();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const chunkSize = 200;
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks: string[] = [];
      let current = "";

      for (const sentence of sentences) {
        if ((current + sentence).length <= chunkSize) {
          current += sentence;
        } else {
          if (current) chunks.push(current.trim());
          current = sentence;
        }
      }
      if (current) chunks.push(current.trim());
      if (chunks.length === 0) chunks.push(text);

      timeoutRef.current = setTimeout(() => {
        stopSpeaking();
        toast({
          title: "Speech Timeout",
          description: "Speech stopped after maximum duration.",
          variant: "default",
        });
      }, MAX_SPEECH_TIME);

      speakChunks(chunks, 0, messageId);
    },
    [speakChunks, toast]
  );

  const stopSpeaking = useCallback((clearPaused = false) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    speechRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (clearPaused) {
      pausedRef.current = null;
      currentRef.current = null;
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const newMuted = !isMuted;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);

    if (newMuted && isSpeaking && currentRef.current) {
      const current = currentRef.current;
      if (current.messageId) {
        pausedRef.current = {
          chunks: current.chunks,
          index: current.index,
          messageId: current.messageId,
        };
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      speechRef.current = null;
    } else if (!newMuted && pausedRef.current) {
      const paused = pausedRef.current;
      setTimeout(() => {
        timeoutRef.current = setTimeout(() => {
          stopSpeaking(true);
          toast({
            title: "Speech Timeout",
            description: "Speech stopped after maximum duration.",
            variant: "default",
          });
        }, MAX_SPEECH_TIME);

        setIsSpeaking(true);
        speakChunks(paused.chunks, paused.index, paused.messageId);
      }, 100);
    }
  }, [isMuted, isSpeaking, speakChunks, stopSpeaking, toast]);

  const handleStartRecording = useCallback(() => {
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
      stopSpeaking();
      setTranscript("");
      setIsRecording(true);

      try {
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (error) {
        setIsRecording(false);
        toast({
          title: "Recording Error",
          description: "Failed to start recording. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
  }, [isSpeechSupported, isRecording, stopSpeaking, toast]);

  useEffect(() => {
    const stopSpeech = () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      speechRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    window.addEventListener("beforeunload", stopSpeech);
    window.addEventListener("unload", stopSpeech);
    window.addEventListener("pagehide", stopSpeech);

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
      stopSpeech();
    };
  }, []);

  return {
    isSpeaking,
    isRecording,
    transcript,
    isSpeechSupported,
    isMuted,
    speakText,
    stopSpeaking,
    handleToggleMute,
    handleStartRecording,
    lastSpokenMessageIdRef: lastMessageIdRef,
  };
}
