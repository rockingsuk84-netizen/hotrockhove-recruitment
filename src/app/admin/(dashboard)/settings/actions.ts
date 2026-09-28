"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";
import {
  BENEFIT_ICONS,
  CV_FILE_TYPES,
  getSetting,
  homepageSettingsSchema,
  imageRefSchema,
  mergeStorageSettings,
  notificationSettingsSchema,
  privacySettingsSchema,
  saveSetting,
  siteSettingsSchema,
  uploadSettingsSchema,
} from "@/lib/settings";
import { buildAdapter } from "@/lib/storage";
import { fieldErrors } from "@/lib/validation";

export type SettingsState = { error?: string; success?: string; fields?: Record<string, string> };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

async function done(key: string, userId: string, message = "Settings saved."): Promise<SettingsState> {
  await audit("settings.update", { actorUserId: userId, entityType: "settings", entityId: key });
  revalidatePath("/", "layout");
  return { success: message };
}

export async function saveSiteSettings(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const parsed = siteSettingsSchema.safeParse({
    brandName: str(fd, "brandName"),
    tagline: str(fd, "tagline"),
    logoUrl: str(fd, "logoUrl").trim(),
    primaryColour: str(fd, "primaryColour"),
    accentColour: str(fd, "accentColour"),
    contactEmail: str(fd, "contactEmail").trim(),
    footerText: str(fd, "footerText"),
    instagramUrl: str(fd, "instagramUrl").trim(),
    linkedinUrl: str(fd, "linkedinUrl").trim(),
    facebookUrl: str(fd, "facebookUrl").trim(),
  });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) };
  await saveSetting("site", parsed.data, user.id);
  return done("site", user.id);
}

export async function saveHomepageSettings(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  // Benefits: one per line, "icon | label" (icon optional, defaults to "star").
  const benefits = str(fd, "benefits")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [a, b] = line.split("|").map((x) => x.trim());
      const icon = b !== undefined && (BENEFIT_ICONS as readonly string[]).includes(a.toLowerCase()) ? a.toLowerCase() : "star";
      return { icon, label: b ?? a };
    });
  const parsed = homepageSettingsSchema.safeParse({
    heroEyebrow: str(fd, "heroEyebrow"),
    heroTitle: str(fd, "heroTitle"),
    heroHighlight: str(fd, "heroHighlight"),
    heroText: str(fd, "heroText"),
    heroCta: str(fd, "heroCta"),
    heroImage: str(fd, "heroImage").trim(),
    vacanciesEyebrow: str(fd, "vacanciesEyebrow"),
    vacanciesTitle: str(fd, "vacanciesTitle"),
    vacanciesText: str(fd, "vacanciesText"),
    whyEyebrow: str(fd, "whyEyebrow"),
    whyTitle: str(fd, "whyTitle"),
    whyText: str(fd, "whyText"),
    whyImage: str(fd, "whyImage").trim(),
    benefits,
    aboutTitle: str(fd, "aboutTitle"),
    aboutText: str(fd, "aboutText"),
  });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fields: storageFieldErrors(parsed.error) };
  await saveSetting("homepage", parsed.data, user.id);
  return done("homepage", user.id, "Homepage saved.");
}

export async function saveNotificationSettings(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const parsed = notificationSettingsSchema.safeParse({
    adminRecipients: str(fd, "adminRecipients")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    sendApplicantConfirmation: fd.get("sendApplicantConfirmation") === "on",
    sendAdminNotification: fd.get("sendAdminNotification") === "on",
    applicantConfirmationSubject: str(fd, "applicantConfirmationSubject"),
    applicantConfirmationBody: str(fd, "applicantConfirmationBody"),
    adminNotificationSubject: str(fd, "adminNotificationSubject"),
  });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) };
  await saveSetting("notifications", parsed.data, user.id);
  return done("notifications", user.id);
}

export async function savePrivacySettings(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const retention = str(fd, "retentionDays").trim();
  const privacy = privacySettingsSchema.safeParse({
    consentText: str(fd, "consentText"),
    privacyPolicy: str(fd, "privacyPolicy"),
    terms: str(fd, "terms"),
    retentionDays: retention === "" ? null : Number(retention),
  });
  const uploads = uploadSettingsSchema.safeParse({
    maxCvBytes: Math.round(Number(str(fd, "maxCvMb")) * 1024 * 1024),
    allowedCvTypes: fd.getAll("allowedCvTypes").filter((v) => (CV_FILE_TYPES as readonly string[]).includes(String(v))),
  });
  if (!privacy.success || !uploads.success) {
    const fields = {
      ...(privacy.success ? {} : fieldErrors(privacy.error)),
      ...(uploads.success ? {} : fieldErrors(uploads.error)),
    };
    if (fields.maxCvBytes) fields.maxCvMb = "Choose a limit between 0.1 MB and 4 MB.";
    if (fields.allowedCvTypes) fields.allowedCvTypes = "Allow at least one file type.";
    if (fields.retentionDays) fields.retentionDays = "Enter between 30 and 3650 days, or leave blank to disable.";
    return { error: "Please check the highlighted fields.", fields };
  }
  await saveSetting("privacy", privacy.data, user.id);
  await saveSetting("uploads", uploads.data, user.id);
  return done("privacy", user.id);
}

const storageInputSchema = z.object({
  provider: z.enum(["cloudinary", "s3", "local"]),
  cloudinary: z.object({
    cloudName: z.string().trim().max(100).regex(/^[a-zA-Z0-9_-]*$/, "Invalid cloud name"),
    apiKey: z.string().trim().max(100),
    apiSecret: z.string().max(200),
    folder: z.string().trim().max(100).regex(/^[a-zA-Z0-9_/-]*$/, "Use letters, numbers, - _ and /"),
  }),
  s3: z.object({
    bucket: z.string().trim().max(63).regex(/^[a-z0-9.-]*$/, "Invalid bucket name"),
    region: z.string().trim().max(30).regex(/^[a-z0-9-]*$/, "Invalid region"),
    accessKeyId: z.string().trim().max(128),
    secretAccessKey: z.string().max(256),
    cdnUrl: z.union([z.literal(""), z.string().trim().url().startsWith("https://")]),
    prefix: z.string().trim().max(100).regex(/^[a-zA-Z0-9_/-]*$/, "Use letters, numbers, - _ and /"),
  }),
});

function readStorageForm(fd: FormData) {
  return storageInputSchema.safeParse({
    provider: str(fd, "provider"),
    cloudinary: {
      cloudName: str(fd, "cloudinary.cloudName"),
      apiKey: str(fd, "cloudinary.apiKey"),
      apiSecret: str(fd, "cloudinary.apiSecret"),
      folder: str(fd, "cloudinary.folder"),
    },
    s3: {
      bucket: str(fd, "s3.bucket"),
      region: str(fd, "s3.region"),
      accessKeyId: str(fd, "s3.accessKeyId"),
      secretAccessKey: str(fd, "s3.secretAccessKey"),
      cdnUrl: str(fd, "s3.cdnUrl").trim(),
      prefix: str(fd, "s3.prefix"),
    },
  });
}

function storageFieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] ??= issue.message;
  return out;
}

/** Storage form handler: intent=test runs a connection test, otherwise settings are saved. */
export async function storageFormAction(state: SettingsState, fd: FormData): Promise<SettingsState> {
  return fd.get("intent") === "test" ? testStorageConnection(state, fd) : saveStorageSettings(state, fd);
}

async function saveStorageSettings(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const parsed = readStorageForm(fd);
  if (!parsed.success) return { error: "Please check the highlighted fields.", fields: storageFieldErrors(parsed.error) };
  if (parsed.data.provider === "local" && process.env.ALLOW_LOCAL_STORAGE !== "true") {
    return { error: "Local storage is only available in development." };
  }
  const current = await getSetting("storage");
  const merged = mergeStorageSettings(current, parsed.data);
  try {
    buildAdapter(merged.provider, merged); // ensures required fields for the active provider are present
  } catch {
    return { error: `Complete all required ${merged.provider === "s3" ? "Amazon S3" : "Cloudinary"} fields before selecting it.` };
  }
  await saveSetting("storage", merged, user.id);
  await audit("settings.update", {
    actorUserId: user.id,
    entityType: "settings",
    entityId: "storage",
    metadata: {
      provider: merged.provider,
      cloudinarySecretChanged: Boolean(parsed.data.cloudinary.apiSecret),
      s3SecretChanged: Boolean(parsed.data.s3.secretAccessKey),
    },
  });
  revalidatePath("/admin/settings/storage");
  return { success: "Storage settings saved. New uploads will use the selected provider." };
}

/** Tests the provider selected in the form, using unsaved values where given and stored secrets otherwise. */
async function testStorageConnection(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const parsed = readStorageForm(fd);
  if (!parsed.success) return { error: "Please check the highlighted fields.", fields: storageFieldErrors(parsed.error) };
  if (parsed.data.provider === "local" && process.env.ALLOW_LOCAL_STORAGE !== "true") {
    return { error: "Local storage is only available in development." };
  }
  const merged = mergeStorageSettings(await getSetting("storage"), parsed.data);
  let result;
  try {
    result = await buildAdapter(merged.provider, merged).testConnection();
  } catch {
    result = { ok: false, message: "Some required fields are missing for this provider." };
  }
  await audit("storage.test", { actorUserId: user.id, metadata: { provider: merged.provider, ok: result.ok } });
  return result.ok ? { success: result.message } : { error: result.message };
}

/* ----------------------------- Taxonomy lists ----------------------------- */

const TABLES = {
  locations: t.locations,
  departments: t.departments,
  employmentTypes: t.employmentTypes,
  positions: t.positions,
} as const;
type ListName = keyof typeof TABLES;

export async function addListItem(list: ListName, _: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const name = z.string().trim().min(1).max(100).safeParse(fd.get("name"));
  if (!name.success || !(list in TABLES)) return { error: "Enter a name." };
  const table = TABLES[list];
  const exists = await db.select({ id: table.id }).from(table).where(eq(table.name, name.data)).limit(1);
  if (exists.length) return { error: `"${name.data}" already exists.` };
  await db.insert(table).values({ name: name.data, sortOrder: 999 });
  await audit("taxonomy.update", { actorUserId: user.id, entityType: list, metadata: { action: "add" } });
  revalidatePath("/admin/settings/lists");
  return { success: `Added "${name.data}".` };
}

export async function toggleListItem(list: ListName, id: string, active: boolean) {
  const user = await requireAdmin();
  if (!(list in TABLES) || !z.string().uuid().safeParse(id).success) return;
  const table = TABLES[list];
  await db.update(table).set({ active }).where(eq(table.id, id));
  await audit("taxonomy.update", { actorUserId: user.id, entityType: list, entityId: id, metadata: { active } });
  revalidatePath("/admin/settings/lists");
}

const departmentSchema = z.object({
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens")
    .transform((v) => v || null),
  tagline: z.string().trim().max(160),
  imageUrl: z.union([z.literal(""), imageRefSchema]).transform((v) => v || null),
  icon: z.enum(["", "cloche", "chef-hat", "glass", "home", "star"]).transform((v) => v || null),
});

/** Presentation fields for department category cards on the public site. */
export async function updateDepartment(id: string, _: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { error: "Department not found." };
  const parsed = departmentSchema.safeParse({
    slug: str(fd, "slug"),
    tagline: str(fd, "tagline"),
    imageUrl: str(fd, "imageUrl").trim(),
    icon: str(fd, "icon"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const slug = parsed.data.slug;
  if (slug) {
    const clash = await db.query.departments.findFirst({ where: (d, { and, eq, ne }) => and(eq(d.slug, slug), ne(d.id, id)) });
    if (clash) return { error: `Another department already uses "${slug}".` };
  }
  await db.update(t.departments).set(parsed.data).where(eq(t.departments.id, id));
  await audit("taxonomy.update", { actorUserId: user.id, entityType: "departments", entityId: id, metadata: { action: "presentation" } });
  revalidatePath("/", "layout");
  return { success: "Saved." };
}
