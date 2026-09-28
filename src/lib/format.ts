/** UK display conventions. Timestamps are stored in UTC and shown in Europe/London time. */
const TZ = "Europe/London";

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(d: Date | string | null | undefined) {
  return d ? dateFmt.format(new Date(d)) : "—";
}

export function formatDateTime(d: Date | string | null | undefined) {
  return d ? dateTimeFmt.format(new Date(d)) : "—";
}

export function formatGbp(minorUnits: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minorUnits / 100);
}

export const STATUS_LABELS = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  interview: "Interview",
  rejected: "Rejected",
  hired: "Hired",
} as const;

export const JOB_STATUS_LABELS = { draft: "Draft", published: "Published", closed: "Closed" } as const;
