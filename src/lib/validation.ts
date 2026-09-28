import { z } from "zod";

/** Normalise an email for matching returning applicants. */
export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

const phone = z
  .string()
  .trim()
  .max(30, "Please enter a valid phone number.")
  .regex(/^\+?[0-9 ()-]{7,}$/, "Please enter a valid phone number.")
  .refine((v) => v.replace(/\D/g, "").length >= 10, "Please enter a valid phone number.");

export const applicationFieldsSchema = z.object({
  jobId: z.string().uuid(),
  positionId: z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null),
  fullName: z.string().trim().min(2, "Please enter your full name.").max(100, "Name is too long."),
  email: z.string().trim().max(254).email("Please enter a valid email address.").transform(normaliseEmail),
  phone,
  standoutQuality: z
    .string()
    .trim()
    .min(3, "Please tell us the quality that makes you stand out.")
    .max(500, "Please keep this under 500 characters."),
  coverMessage: z
    .string()
    .trim()
    .max(3000, "Please keep your message under 3,000 characters.")
    .transform((v) => v || null),
  source: z
    .string()
    .max(40)
    .transform((v) => v.toLowerCase().replace(/[^a-z0-9-]/g, "") || null),
  consent: z.literal("yes", { message: "Please confirm you have read the privacy information." }),
  submissionToken: z.string().uuid(),
});

export type ApplicationFields = z.infer<typeof applicationFieldsSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
