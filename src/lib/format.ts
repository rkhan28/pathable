/**
 * Locale-aware formatting helpers. They take the BCP 47 locale explicitly so
 * they are pure (and unit-testable) and work in both server and client code.
 */

export function formatDistance(meters: number, locale: string): string {
  if (meters < 1000) {
    const rounded = meters < 100 ? Math.round(meters / 5) * 5 : Math.round(meters / 10) * 10;
    return new Intl.NumberFormat(locale, { style: "unit", unit: "meter", unitDisplay: "short", maximumFractionDigits: 0 }).format(
      Math.max(rounded, meters > 0 ? 5 : 0),
    );
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "kilometer",
    unitDisplay: "short",
    maximumFractionDigits: meters < 10_000 ? 1 : 0,
  }).format(meters / 1000);
}

/** Long, screen-reader friendly variant ("1.2 kilometres"). */
export function formatDistanceLong(meters: number, locale: string): string {
  if (meters < 1000) {
    return new Intl.NumberFormat(locale, { style: "unit", unit: "meter", unitDisplay: "long", maximumFractionDigits: 0 }).format(
      Math.round(meters / 10) * 10 || Math.round(meters),
    );
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: "kilometer", unitDisplay: "long", maximumFractionDigits: 1 }).format(
    meters / 1000,
  );
}

export function formatDuration(seconds: number, locale: string, display: "short" | "long" = "short"): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const unit = (value: number, u: "hour" | "minute") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: display }).format(value);
  if (hours === 0) return unit(minutes, "minute");
  if (minutes === 0) return unit(hours, "hour");
  return new Intl.ListFormat(locale, { style: display === "long" ? "long" : "narrow", type: "unit" }).format([
    unit(hours, "hour"),
    unit(minutes, "minute"),
  ]);
}

export function formatPercent(fraction: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(fraction);
}

/** "3 days ago" style relative time, falling back to an absolute date beyond ~5 weeks. */
export function formatRelativeTime(iso: string, locale: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffSeconds = (then.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSeconds), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86_400 * 35) return rtf.format(Math.round(diffSeconds / 86_400), "day");
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(then);
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }).format(
    new Date(iso),
  );
}

/** Walking/rolling speed used for duration estimates when the API doesn't provide one. */
export const DEFAULT_SPEED_MPS = 1.0;
