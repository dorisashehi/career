import {
  ExternalLink,
  Calendar,
  ThumbsUp,
  MessageSquare,
} from "lucide-react";
import type { Source } from "@/lib/api";

interface MessageSourcesProps {
  sources: Source[];
}

/**
 * Formats upvote scores for display.
 * Converts large numbers to abbreviated format (e.g., 1500 -> "1.5k").
 */
const formatUpvotes = (score: number | undefined) => {
  if (!score) return null;
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`;
  }
  return score.toString();
};

/**
 * Formats date strings for display in source links.
 * Converts ISO date strings to readable format (e.g., "Jan 15, 2024").
 * Falls back to original string if parsing fails.
 */
const formatDate = (dateStr: string | undefined) => {
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

export function MessageSources({ sources }: MessageSourcesProps) {
  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-xs font-semibold text-foreground mb-3">Sources:</p>
      <div className="space-y-2">
        {sources.map((source, idx) => (
          <a
            key={idx}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 p-2 rounded-lg bg-background/50 hover:bg-background/80 border border-border/30 hover:border-primary/50 smooth-hover shadow-sm hover:shadow-md transition-all duration-200 group"
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
                    <span>{formatDate(source.date)}</span>
                  </div>
                )}
                {source.score && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ThumbsUp className="w-3 h-3" />
                    <span>{formatUpvotes(source.score)} upvotes</span>
                  </div>
                )}
                {source.num_comments && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="w-3 h-3" />
                    <span>{source.num_comments} comments</span>
                  </div>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

