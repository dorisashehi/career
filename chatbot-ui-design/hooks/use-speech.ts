"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePathname } from "next/navigation";

const MAX_SPEECH_TIME = 5 * 60 * 1000;
const SILENCE_TIMEOUT = 1500;

export function useSpeech(onTranscriptComplete?: (text: string) => void) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const { toast } = useToast();
  const pathname = usePathname();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const isMutedRef = useRef(false);
  const callbackRef = useRef(onTranscriptComplete);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const pausedRef = useRef<{
    text: string;
    messageId: string;
    audio?: HTMLAudioElement; // Store audio if it was paused mid-playback
  } | null>(null);
  const isManualStopRef = useRef<boolean>(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAudioRef = useRef<{
    audio: HTMLAudioElement;
    messageId: string;
    resolve: () => void;
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
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        let tempText = "";
        let newFinalText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            newFinalText += text + " ";
          } else {
            tempText += text;
          }
        }

        if (newFinalText) {
          finalTranscriptRef.current = (
            finalTranscriptRef.current +
            " " +
            newFinalText
          ).trim();
        }

        const displayText =
          finalTranscriptRef.current + (tempText ? " " + tempText : "");
        setTranscript(displayText.trim());

        silenceTimeoutRef.current = setTimeout(() => {
          const finalText = finalTranscriptRef.current.trim();
          if (finalText && callbackRef.current && !isManualStopRef.current) {
            callbackRef.current(finalText);
            finalTranscriptRef.current = "";
            setTranscript("");
            setIsRecording(false);
            if (recognitionRef.current) {
              recognitionRef.current.stop();
            }
          }
          silenceTimeoutRef.current = null;
        }, SILENCE_TIMEOUT);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        setIsRecording(false);
        setTranscript("");
        isManualStopRef.current = false;

        let errorMsg = "Something went wrong with speech recognition.";
        if (event.error === "no-speech") {
          return;
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
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        const finalText = finalTranscriptRef.current.trim();
        if (isManualStopRef.current && finalText && callbackRef.current) {
          setTimeout(() => {
            callbackRef.current?.(finalText);
            finalTranscriptRef.current = "";
            setTranscript("");
          }, 100);
        }
        setIsRecording(false);
        setTranscript("");
        isManualStopRef.current = false;
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
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [toast]);

  const stopSpeaking = useCallback((clearPaused = false) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsLoadingAudio(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (clearPaused) {
      pausedRef.current = null;
    }
    pendingAudioRef.current = null;
  }, []);

  // Pre-load audio without playing
  const preloadAudio = useCallback(
    async (text: string, messageId: string): Promise<void> => {
      if (!text || text.trim().length === 0) return;

      // Store message ID
      if (messageId) {
        lastMessageIdRef.current = messageId;
      }

      // If muted, just store the paused state with text
      if (isMutedRef.current) {
        pausedRef.current = { text, messageId };
        return;
      }

      setIsLoadingAudio(true);

      try {
        // Call the TTS API
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const error = await response.json();
          const errorMessage =
            error.message || error.error || "Failed to generate speech";
          console.error("TTS API Error:", error);
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Create audio element
        const audio = new Audio(
          `data:audio/${data.format};base64,${data.audio}`
        );

        // Wait for audio to be ready
        await new Promise<void>((resolve, reject) => {
          audio.oncanplaythrough = () => resolve();
          audio.onerror = () => reject(new Error("Failed to load audio"));
          audio.load();
        });

        // Setup audio event handlers
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          pausedRef.current = null;
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        };
        audio.onpause = () => {
          if (!isMutedRef.current) {
            setIsSpeaking(false);
          }
        };

        // Store the preloaded audio
        pendingAudioRef.current = {
          audio,
          messageId,
          resolve: () => {
            audioRef.current = audio;

            // Set speaking to true IMMEDIATELY before playing
            setIsSpeaking(true);
            audio.play().catch(console.error);

            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
              stopSpeaking();
              toast({
                title: "Speech Timeout",
                description: "Speech stopped after maximum duration.",
                variant: "default",
              });
            }, MAX_SPEECH_TIME);
          },
        };

        setIsLoadingAudio(false);
      } catch (error: any) {
        console.error("TTS Error:", error);
        setIsLoadingAudio(false);
        pendingAudioRef.current = null;
        toast({
          title: "Text-to-Speech Error",
          description:
            error.message || "Failed to generate speech. Please try again.",
          variant: "destructive",
        });
      }
    },
    [toast, stopSpeaking]
  );

  const speakText = useCallback(
    async (text: string, messageId?: string) => {
      if (!text || text.trim().length === 0) return;

      if (messageId) {
        lastMessageIdRef.current = messageId;
      }

      if (isMutedRef.current) {
        if (messageId) {
          pausedRef.current = { text, messageId };
        }
        return;
      }

      stopSpeaking();

      // If audio is already preloaded for this message, play it immediately
      if (
        pendingAudioRef.current &&
        pendingAudioRef.current.messageId === messageId
      ) {
        pendingAudioRef.current.resolve();
        pendingAudioRef.current = null;
        return;
      }

      // Otherwise load and play
      await preloadAudio(text, messageId || Date.now().toString());
      if (pendingAudioRef.current) {
        pendingAudioRef.current.resolve();
        pendingAudioRef.current = null;
      }
    },
    [stopSpeaking, preloadAudio]
  );

  const handleToggleMute = useCallback(() => {
    const newMuted = !isMuted;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);

    if (newMuted) {
      // Muting: pause current audio if playing
      if (isSpeaking && audioRef.current) {
        // Store the current audio for potential resume
        // Keep existing pausedRef if it has text, otherwise create new one
        if (!pausedRef.current || !pausedRef.current.text) {
          pausedRef.current = {
            text: "", // Text will be provided when unmuting via speakText
            messageId: lastMessageIdRef.current || "",
            audio: audioRef.current,
          };
        } else {
          // Keep the text but update audio reference
          pausedRef.current.audio = audioRef.current;
        }
        audioRef.current.pause();
        setIsSpeaking(false);
      } else if (isLoadingAudio && pendingAudioRef.current) {
        // If audio is loading, the text should already be in pausedRef from preloadAudio
        // Just make sure we have the messageId
        if (!pausedRef.current) {
          pausedRef.current = {
            text: "",
            messageId: pendingAudioRef.current.messageId,
          };
        }
      }
    } else {
      // Unmuting: resume playback
      if (pausedRef.current) {
        const paused = pausedRef.current;

        // If we have a paused audio element, resume it (best case - instant resume)
        if (paused.audio && paused.audio.paused) {
          paused.audio.play().catch(console.error);
          audioRef.current = paused.audio;
          setIsSpeaking(true);
          pausedRef.current = null;
          return;
        }

        // If we have pending audio for this message, play it immediately
        if (
          pendingAudioRef.current &&
          pendingAudioRef.current.messageId === paused.messageId
        ) {
          pendingAudioRef.current.resolve();
          pendingAudioRef.current = null;
          pausedRef.current = null;
          return;
        }

        // If we have the text, use speakText to load and play
        if (paused.text) {
          setTimeout(() => {
            speakText(paused.text, paused.messageId);
            pausedRef.current = null;
          }, 100);
          return;
        }
      }

      // If there's pending audio but no paused state, play it
      if (pendingAudioRef.current && !isMutedRef.current) {
        pendingAudioRef.current.resolve();
        pendingAudioRef.current = null;
      }

      // If unmuting and there's no paused/pending audio, check if we should load audio
      // This handles the case where user unmutes after a message was added while muted
      // The useEffect in the component will handle triggering speakText for the latest message
    }
  }, [isMuted, isSpeaking, isLoadingAudio, speakText]);

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
      finalTranscriptRef.current = "";
      setIsRecording(true);
      isManualStopRef.current = false;

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

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
      isManualStopRef.current = true;

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
  }, [isSpeechSupported, isRecording, stopSpeaking, toast]);

  useEffect(() => {
    stopSpeaking(true);
  }, [pathname, stopSpeaking]);

  useEffect(() => {
    const stopSpeech = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      setIsSpeaking(false);
      setIsLoadingAudio(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      pendingAudioRef.current = null;
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
    isLoadingAudio,
    speakText,
    stopSpeaking,
    preloadAudio,
    handleToggleMute,
    handleStartRecording,
    lastSpokenMessageIdRef: lastMessageIdRef,
  };
}
