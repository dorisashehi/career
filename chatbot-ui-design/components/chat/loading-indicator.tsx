export function LoadingIndicator() {
  return (
    <div className="flex items-start animate-fade-in">
      <div className="bg-muted rounded-2xl px-4 py-3 shadow-sm border border-border/30">
        <div className="flex gap-1">
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <div
            className="w-2 h-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}

