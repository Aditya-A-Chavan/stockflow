/** Format a DATE column value (YYYY-MM-DD) for display without timezone drift. */
export function formatDueDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return dateStr;
}

/** Parse optional due date from form input; returns null if empty. */
export function parseDueDateInput(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed;
}

/** Relative time label for activity feed. */
export function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Today formatted for dashboard header (en-IN style). */
export function todayLabel(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
