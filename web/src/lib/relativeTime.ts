/** Compact relative time for rail rows (e.g. 1m, 3h, 6d). */
export function formatRelativeShort(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";

  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "1m";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  const years = Math.floor(days / 365);
  return `${Math.max(1, years)}y`;
}

export function formatRelativeTitle(iso: string, timezone: string): string {
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return "";
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(then);
}
