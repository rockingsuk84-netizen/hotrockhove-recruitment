/**
 * Interview details: input validation, UK time handling and wording. Pure
 * functions shared by the admin actions, the emails and the tests.
 */
import { z } from "zod";

export const INTERVIEW_MODES = ["in_person", "online", "phone"] as const;
export type Mode = (typeof INTERVIEW_MODES)[number];

export const MODE_LABELS: Record<Mode, string> = { in_person: "In person", online: "Online", phone: "Phone call" };
export const DURATIONS = [15, 20, 30, 45, 60, 90] as const;

const TZ = "Europe/London";

/* -------------------------------------------------------------------------- */
/* UK local time <-> UTC                                                      */
/* -------------------------------------------------------------------------- */

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Minutes London is ahead of UTC at the given instant (0 in winter, 60 in summer). */
function londonOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((wall - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/**
 * Convert a `<input type="datetime-local">` value, read as UK time, to a UTC Date.
 * Returns null for malformed input or a time that doesn't exist (the hour skipped
 * when the clocks go forward).
 */
export function londonLocalToUtc(value: string): Date | null {
  const m = LOCAL.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(naive)) return null;
  let result = new Date(naive - londonOffsetMinutes(new Date(naive)) * 60000);
  // Re-check with the offset at the result, which differs near a clock change.
  result = new Date(naive - londonOffsetMinutes(result) * 60000);
  return utcToLondonLocal(result) === value ? result : null;
}

/** UTC Date to a `datetime-local` value in UK time (for pre-filling inputs). */
export function utcToLondonLocal(at: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "Tuesday 18 November 2026 at 2:30pm" in UK time. */
export function formatInterviewTime(at: Date): string {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(at)
    .replace(",", "");
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .format(at)
    .replace(/\s/g, "")
    .replace(":00", "")
    .toLowerCase();
  return `${day} at ${time}`;
}

/* -------------------------------------------------------------------------- */
/* Shared details entered by staff                                            */
/* -------------------------------------------------------------------------- */

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => v || null);

export const interviewDetailsSchema = z
  .object({
    mode: z.enum(INTERVIEW_MODES, { message: "Choose how the interview will happen." }),
    durationMinutes: z.coerce
      .number()
      .int()
      .refine((n) => (DURATIONS as readonly number[]).includes(n), "Choose a length."),
    location: optionalText(300, "Keep the address under 300 characters."),
    meetingLink: optionalText(500, "That link is too long."),
    contactName: optionalText(100, "Keep the name under 100 characters."),
    notes: optionalText(2000, "Keep the notes under 2,000 characters."),
  })
  .superRefine((d, ctx) => {
    if (d.mode === "in_person" && !d.location) ctx.addIssue({ code: "custom", path: ["location"], message: "Enter the address." });
    if (d.mode === "online") {
      if (!d.meetingLink) ctx.addIssue({ code: "custom", path: ["meetingLink"], message: "Enter the meeting link." });
      else if (!isHttpsUrl(d.meetingLink)) {
        ctx.addIssue({ code: "custom", path: ["meetingLink"], message: "Enter a full link starting with https://" });
      }
    }
  })
  // Keep only what applies to the chosen format.
  .transform((d) => ({
    ...d,
    location: d.mode === "in_person" ? d.location : null,
    meetingLink: d.mode === "online" ? d.meetingLink : null,
  }));

export type InterviewDetails = z.infer<typeof interviewDetailsSchema>;

export function isHttpsUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && Boolean(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Parse one person's time. Interviews must be in the future. */
export function parseInterviewTime(value: string, now = new Date()): { ok: true; at: Date } | { ok: false; error: string } {
  if (!value) return { ok: false, error: "Enter a date and time." };
  const at = londonLocalToUtc(value);
  if (!at) return { ok: false, error: "Enter a valid date and time." };
  if (at.getTime() <= now.getTime()) return { ok: false, error: "Choose a time in the future." };
  if (at.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1000) return { ok: false, error: "Choose a time within the next year." };
  return { ok: true, at };
}
