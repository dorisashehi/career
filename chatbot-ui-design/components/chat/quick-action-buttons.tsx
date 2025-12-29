import { Button } from "@/components/ui/button";

interface QuickActionButtonsProps {
  onSelect: (text: string) => void;
}

const QUICK_ACTIONS = [
  { label: "Salary Tips", text: "How do I negotiate a better salary?" },
  { label: "Career Change", text: "I want to change careers" },
  { label: "Interview Prep", text: "Help me prepare for an interview" },
];

export function QuickActionButtons({ onSelect }: QuickActionButtonsProps) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {QUICK_ACTIONS.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          onClick={() => onSelect(action.text)}
          className="border-border/50 hover:border-primary/50 hover:bg-primary/5 smooth-hover shadow-sm hover:shadow-md transition-all duration-200"
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

