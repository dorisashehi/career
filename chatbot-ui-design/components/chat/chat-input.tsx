import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onKeyPress,
}: ChatInputProps) {
  return (
    <div className="border-t border-border p-4 bg-card">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="Ask about your career goals..."
          className="flex-1 text-base"
        />
        <Button
          onClick={onSend}
          size="icon"
          className="bg-primary hover:bg-primary/90"
          disabled={!value.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

