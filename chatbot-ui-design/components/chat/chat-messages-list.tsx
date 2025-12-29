import { Card } from "@/components/ui/card";
import type { Message } from "./types";
import { ChatMessage } from "./chat-message";
import { LoadingIndicator } from "./loading-indicator";

interface ChatMessagesListProps {
  messages: Message[];
  isLoadingAudio: boolean;
  forceShowMessages: Set<string>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  lastCoachMessageRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessagesList({
  messages,
  isLoadingAudio,
  forceShowMessages,
  messagesEndRef,
  lastCoachMessageRef,
}: ChatMessagesListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.length === 0 && (
        <div className="h-full flex items-center justify-center text-muted-foreground text-center p-8">
          <p className="text-lg">Starting your career coaching session...</p>
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
          <ChatMessage
            key={message.id}
            message={message}
            index={index}
            isLastMessage={isLastMessage}
            lastCoachMessageRef={lastCoachMessageRef}
          />
        );
      })}

      {isLoadingAudio && <LoadingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
}

