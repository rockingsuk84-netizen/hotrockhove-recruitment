import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { decryptSecret, encryptSecret, isEncrypted } from "./crypto";

/* -------------------------------------------------------------------------- */
/* Schemas & defaults                                                         */
/* -------------------------------------------------------------------------- */

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour such as #1f2937");
const optionalHttps = z.union([z.literal(""), z.string().trim().url().startsWith("https://")]);

/** A project image (`/images/hero.jpg`) or an https:// URL such as a Cloudinary asset. */
export const imageRefSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/images\/[A-Za-z0-9._/-]+|https:\/\/\S+)$/, "Use /images/… or an https:// image URL");
const optionalImageRef = z.union([z.literal(""), imageRefSchema]);

export const siteSettingsSchema = z.object({
  brandName: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160),
  logoUrl: z.union([z.literal(""), z.string().trim().url().startsWith("https://")]),
  primaryColour: hexColour,
  accentColour: hexColour,
  contactEmail: z.union([z.literal(""), z.string().trim().email()]),
  footerText: z.string().trim().max(300),
  instagramUrl: optionalHttps,
  linkedinUrl: optionalHttps,
  facebookUrl: optionalHttps,
});

export const BENEFIT_ICONS = ["pay", "growth", "training", "team", "perks", "star", "clock", "home"] as const;

export const homepageSettingsSchema = z.object({
  heroEyebrow: z.string().trim().max(80),
  heroTitle: z.string().trim().min(3).max(120),
  /** Word(s) in the title shown in the italic accent style. */
  heroHighlight: z.string().trim().max(60),
  heroText: z.string().trim().max(400),
  heroCta: z.string().trim().min(2).max(40),
  heroImage: imageRefSchema,
  vacanciesEyebrow: z.string().trim().max(80),
  vacanciesTitle: z.string().trim().min(3).max(120),
  vacanciesText: z.string().trim().max(400),
  whyEyebrow: z.string().trim().max(80),
  whyTitle: z.string().trim().min(3).max(120),
  whyText: z.string().trim().max(400),
  whyImage: optionalImageRef,
  benefits: z.array(z.object({ icon: z.enum(BENEFIT_ICONS), label: z.string().trim().min(2).max(60) })).max(8),
  aboutTitle: z.string().trim().min(3).max(120),
  aboutText: z.string().trim().max(10_000),
});

export const notificationSettingsSchema = z.object({
  adminRecipients: z.array(z.string().trim().email()).max(20),
  sendApplicantConfirmation: z.boolean(),
  sendAdminNotification: z.boolean(),
  applicantConfirmationSubject: z.string().trim().min(1).max(200),
  applicantConfirmationBody: z.string().trim().min(1).max(4000),
  adminNotificationSubject: z.string().trim().min(1).max(200),
});

export const CV_FILE_TYPES = ["pdf", "doc", "docx"] as const;
export type CvFileType = (typeof CV_FILE_TYPES)[number];

/** Vercel functions accept request bodies up to ~4.5 MB, so uploads are capped below that. */
export const MAX_UPLOAD_CEILING_BYTES = 4 * 1024 * 1024;

export const uploadSettingsSchema = z.object({
  maxCvBytes: z.number().int().min(100 * 1024).max(MAX_UPLOAD_CEILING_BYTES),
  allowedCvTypes: z.array(z.enum(CV_FILE_TYPES)).min(1),
});

export const privacySettingsSchema = z.object({
  consentText: z.string().trim().min(10).max(2000),
  privacyPolicy: z.string().trim().min(10).max(50_000),
  /** Days after the last application before applicant data is erased. null = no automatic erasure. */
  retentionDays: z.number().int().min(30).max(3650).nullable(),
  terms: z.string().trim().min(10).max(50_000),
});

const cloudinaryConfigSchema = z.object({
  cloudName: z.string().trim(),
  apiKey: z.string().trim(),
  apiSecret: z.string(), // encrypted at rest
  folder: z.string().trim(),
});

const s3ConfigSchema = z.object({
  bucket: z.string().trim(),
  region: z.string().trim(),
  accessKeyId: z.string().trim(),
  secretAccessKey: z.string(), // encrypted at rest
  cdnUrl: z.string().trim(),
  prefix: z.string().trim(),
});

export const storageSettingsSchema = z.object({
  provider: z.enum(["cloudinary", "s3", "local"]),
  cloudinary: cloudinaryConfigSchema,
  s3: s3ConfigSchema,
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type HomepageSettings = z.infer<typeof homepageSettingsSchema>;
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type UploadSettings = z.infer<typeof uploadSettingsSchema>;
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;
export type StorageSettings = z.infer<typeof storageSettingsSchema>;

const SCHEMAS = {
  site: siteSettingsSchema,
  homepage: homepageSettingsSchema,
  notifications: notificationSettingsSchema,
  uploads: uploadSettingsSchema,
  privacy: privacySettingsSchema,
  storage: storageSettingsSchema,
};

const DEFAULTS: { [K in keyof typeof SCHEMAS]: z.infer<(typeof SCHEMAS)[K]> } = {
  site: {
    brandName: "Hotrock Recruitment",
    tagline: "Hospitality careers across the UK",
    logoUrl: "",
    primaryColour: "#0e1a16",
    accentColour: "#d8bd8a",
    contactEmail: "admin@rockingservicesuk.com",
    footerText: "",
    instagramUrl: "",
    linkedinUrl: "",
    facebookUrl: "",
  } satisfies SiteSettings,
  homepage: {
    heroEyebrow: "Hospitality careers across the UK",
    heroTitle: "Build Your Next Career in Hospitality",
    heroHighlight: "Hospitality",
    // Neutral defaults: campaign-specific copy (e.g. the Hove launch) is written by the
    // seed script into the settings table and edited under Configuration → Homepage.
    heroText: "Explore our current vacancies and apply online in a few minutes. No account needed.",
    heroCta: "View Open Positions",
    heroImage: "/images/hero.jpg",
    vacanciesEyebrow: "Current vacancies",
    vacanciesTitle: "Find Your Next Opportunity",
    vacanciesText: "Explore our current vacancies and take the next step in your hospitality career.",
    whyEyebrow: "Why join us",
    whyTitle: "More Than Just a Job",
    whyText: "",
    whyImage: "/images/why-join.jpg",
    benefits: [],
    aboutTitle: "About us",
    aboutText: "Tell applicants about your organisation here. Edit this text under Configuration → Homepage.",
  } satisfies HomepageSettings,
  notifications: {
    adminRecipients: [],
    sendApplicantConfirmation: true,
    sendAdminNotification: true,
    applicantConfirmationSubject: "We've received your application for {{jobTitle}}",
    applicantConfirmationBody:
      "Hello {{applicantName}},\n\nThank you for applying for {{jobTitle}} with {{brandName}}. We've received your application and CV.\n\nOur team reviews every application carefully. If your experience is a good match, we'll be in touch to arrange the next step.\n\nKind regards,\nThe {{brandName}} team",
    adminNotificationSubject: "New application: {{applicantName}} for {{jobTitle}}",
  } satisfies NotificationSettings,
  uploads: {
    maxCvBytes: MAX_UPLOAD_CEILING_BYTES,
    allowedCvTypes: ["pdf", "doc", "docx"],
  } satisfies UploadSettings,
  privacy: {
    consentText:
      "I confirm the information I have provided is accurate, and I consent to {{brandName}} storing and processing my details and CV for the purpose of assessing my application, as described in the Privacy Policy.",
    privacyPolicy:
      "This placeholder privacy notice must be replaced with wording approved by your organisation before launch.\n\nWhat we collect\nYour name, email address, phone number, the role you are applying for, your answers to application questions and your CV.\n\nWhy we collect it\nTo assess your application and contact you about it.\n\nHow long we keep it\nWe keep application data only for as long as necessary for recruitment purposes, after which it is deleted.\n\nYour rights\nYou can ask to access, correct or delete your data at any time by contacting us.",
    retentionDays: 180,
    terms:
      "These placeholder terms must be replaced with wording approved by your organisation before launch.\n\nUse of this website\nThis website is provided to advertise vacancies and receive job applications.\n\nApplications\nSubmitting an application does not guarantee an interview or offer of employment.\n\nContact\nIf you have any questions about these terms, please contact us.",
  } satisfies PrivacySettings,
  storage: {
    provider: "cloudinary",
    cloudinary: { cloudName: "", apiKey: "", apiSecret: "", folder: "recruitment" },
    s3: { bucket: "", region: "eu-west-2", accessKeyId: "", secretAccessKey: "", cdnUrl: "", prefix: "recruitment" },
  } satisfies StorageSettings,
};


type SettingsMap = {
  site: SiteSettings;
  homepage: HomepageSettings;
  notifications: NotificationSettings;
  uploads: UploadSettings;
  privacy: PrivacySettings;
  storage: StorageSettings;
};
export type SettingsKey = keyof SettingsMap;

/* -------------------------------------------------------------------------- */
/* Access                                                                     */
/* -------------------------------------------------------------------------- */

async function readRaw<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> {
  const [row] = await db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1);
  const merged = { ...DEFAULTS[key], ...((row?.value as object | undefined) ?? {}) };
  const parsed = SCHEMAS[key].safeParse(merged);
  return (parsed.success ? parsed.data : DEFAULTS[key]) as SettingsMap[K];
}

/** Per-request cached read. Storage secrets remain encrypted in the returned value. */
export const getSetting = cache(readRaw) as <K extends SettingsKey>(key: K) => Promise<SettingsMap[K]>;

export async function saveSetting<K extends SettingsKey>(key: K, value: SettingsMap[K], userId?: string) {
  const data = SCHEMAS[key].parse(value);
  await db
    .insert(t.settings)
    .values({ key, value: data, updatedById: userId ?? null })
    .onConflictDoUpdate({ target: t.settings.key, set: { value: data, updatedById: userId ?? null } });
}

/* -------------------------------------------------------------------------- */
/* Storage settings helpers                                                   */
/* -------------------------------------------------------------------------- */

/** Safe representation for the browser: secrets replaced by a boolean. */
export type PublicStorageSettings = {
  provider: StorageSettings["provider"];
  cloudinary: Omit<StorageSettings["cloudinary"], "apiSecret"> & { apiSecretSet: boolean };
  s3: Omit<StorageSettings["s3"], "secretAccessKey"> & { secretAccessKeySet: boolean };
};

export function toPublicStorageSettings(s: StorageSettings): PublicStorageSettings {
  const { apiSecret, ...cloudinary } = s.cloudinary;
  const { secretAccessKey, ...s3 } = s.s3;
  return {
    provider: s.provider,
    cloudinary: { ...cloudinary, apiSecretSet: Boolean(apiSecret) },
    s3: { ...s3, secretAccessKeySet: Boolean(secretAccessKey) },
  };
}

/**
 * Merge an admin form submission into stored settings. Empty secret fields keep
 * the existing (encrypted) secret; new secrets are encrypted before storage.
 */
export function mergeStorageSettings(
  current: StorageSettings,
  input: {
    provider: StorageSettings["provider"];
    cloudinary: Omit<StorageSettings["cloudinary"], "apiSecret"> & { apiSecret?: string };
    s3: Omit<StorageSettings["s3"], "secretAccessKey"> & { secretAccessKey?: string };
  },
): StorageSettings {
  return {
    provider: input.provider,
    cloudinary: {
      ...input.cloudinary,
      apiSecret: input.cloudinary.apiSecret ? encryptSecret(input.cloudinary.apiSecret) : current.cloudinary.apiSecret,
    },
    s3: {
      ...input.s3,
      secretAccessKey: input.s3.secretAccessKey
        ? encryptSecret(input.s3.secretAccessKey)
        : current.s3.secretAccessKey,
    },
  };
}

export function revealSecret(value: string): string {
  if (!value) return "";
  return isEncrypted(value) ? decryptSecret(value) : value;
}

/** Replace {{placeholders}} in configurable templates. Unknown keys are left blank. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}
