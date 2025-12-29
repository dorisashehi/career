import ReactMarkdown from "react-markdown";
import type { Message } from "./types";
import { MessageSources } from "./message-sources";

interface ChatMessageProps {
  message: Message;
  index: number;
  isLastMessage: boolean;
  lastCoachMessageRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessage({
  message,
  index,
  isLastMessage,
  lastCoachMessageRef,
}: ChatMessageProps) {
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
          <p className="font-semibold text-sm mb-1 text-foreground">Coach:</p>
        )}
        <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="mb-2 last:mb-0">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
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
              li: ({ children }) => <li className="ml-2">{children}</li>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        {message.role === "coach" &&
          message.sources &&
          message.sources.length > 0 && (
            <MessageSources sources={message.sources} />
          )}
      </div>
      <span className="text-xs text-muted-foreground mt-1 px-2">
        {message.timestamp}
      </span>
    </div>
  );
}

