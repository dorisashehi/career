import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

interface AvatarSectionProps {
  isSpeaking: boolean;
  isRecording: boolean;
  transcript: string;
  isSpeechSupported: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onStartRecording: () => void;
}

export function AvatarSection({
  isSpeaking,
  isRecording,
  transcript,
  isSpeechSupported,
  isMuted,
  onToggleMute,
  onStartRecording,
}: AvatarSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

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

  return (
    <div className="flex flex-col items-center justify-center space-y-6 transition-all duration-700">
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
            onClick={onToggleMute}
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
          When your career path hits a 404, I help you find it. I've learned
          from thousands of real developer stories, interviews gone wrong,
          salary wins, career pivots, and skill upgrades, from Reddit and real
          users like you.
        </p>
      </div>

      <Button
        onClick={onStartRecording}
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
  );
}

