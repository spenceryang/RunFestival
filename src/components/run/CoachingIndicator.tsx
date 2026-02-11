'use client';

/**
 * Visual indicator shown when the AI coach is generating or speaking.
 * Displays animated dots to let the runner know the coach is active.
 */
export function CoachingIndicator({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-festival-card/80 border border-festival-border">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-festival-orange animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-festival-orange animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-festival-orange animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs text-festival-muted ml-1">Coach is speaking</span>
      </div>
    </div>
  );
}
