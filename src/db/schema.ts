/**
 * Domain model.
 *
 * The MVP only exposes jobs, applicants, applications, documents, notes and
 * configuration in the UI. Certificates, employment records, shifts and salary
 * records are deliberately present as minimal foundations so those modules can
 * be added later without reshaping the core entities.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const userRole = pgEnum("user_role", ["owner", "admin", "recruiter", "applicant"]);
export const jobStatus = pgEnum("job_status", ["draft", "published", "closed"]);
export const applicationStatus = pgEnum("application_status", [
  "new",
  "reviewing",
  "shortlisted",
  "interview",
  "rejected",
  "hired",
]);
export const documentType = pgEnum("document_type", [
  "cv",
  "cover_letter",
  "certificate",
  "profile_photo",
  "identity",
  "supporting",
  "employment",
]);
export const storageProvider = pgEnum("storage_provider", ["cloudinary", "s3", "local"]);
export const notificationChannel = pgEnum("notification_channel", ["email", "in_app"]);
export const notificationStatus = pgEnum("notification_status", ["queued", "sent", "failed", "skipped"]);

export const APPLICATION_STATUSES = applicationStatus.enumValues;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type JobStatus = (typeof jobStatus.enumValues)[number];
export type DocumentType = (typeof documentType.enumValues)[number];
export type StorageProviderName = (typeof storageProvider.enumValues)[number];
export type UserRole = (typeof userRole.enumValues)[number];

/* -------------------------------------------------------------------------- */
/* Users & authentication (Better Auth tables)                                */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("recruiter"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Configurable taxonomy                                                      */
/* -------------------------------------------------------------------------- */

const taxonomyColumns = {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
};

/** Departments double as the public job categories (e.g. Front of House, Back of House). */
export const departments = pgTable(
  "departments",
  {
    ...taxonomyColumns,
    /** URL-safe key used for public filtering, e.g. /jobs?department=front-of-house */
    slug: text("slug"),
    tagline: text("tagline").notNull().default(""),
    /** `/images/...` in the project or an https:// URL (e.g. Cloudinary). */
    imageUrl: text("image_url"),
    /** Key from the public icon set (see components/site/icons.tsx). */
    icon: text("icon"),
  },
  (t) => [uniqueIndex("departments_name_uq").on(t.name), uniqueIndex("departments_slug_uq").on(t.slug)],
);

export const employmentTypes = pgTable("employment_types", taxonomyColumns, (t) => [
  uniqueIndex("employment_types_name_uq").on(t.name),
]);

export const locations = pgTable(
  "locations",
  {
    ...taxonomyColumns,
    addressLine: text("address_line"),
    town: text("town"),
    postcode: text("postcode"),
  },
  (t) => [uniqueIndex("locations_name_uq").on(t.name)],
);

export const positions = pgTable(
  "positions",
  {
    ...taxonomyColumns,
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("positions_name_uq").on(t.name)],
);

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export type ApplicationQuestion = {
  id: string;
  label: string;
  helpText?: string;
  type: "short_text" | "long_text";
  required: boolean;
  maxLength: number;
};

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    responsibilities: jsonb("responsibilities").$type<string[]>().notNull().default([]),
    requirements: jsonb("requirements").$type<string[]>().notNull().default([]),
    benefits: jsonb("benefits").$type<string[]>().notNull().default([]),
    /** Prompt for the required "standout quality" answer; configurable per job. */
    standoutPrompt: text("standout_prompt")
      .notNull()
      .default("What single quality makes you stand out in a high-pressure environment?"),
    /** Additional per-job questions. */
    questions: jsonb("questions").$type<ApplicationQuestion[]>().notNull().default([]),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    employmentTypeId: uuid("employment_type_id").references(() => employmentTypes.id, {
      onDelete: "set null",
    }),
    status: jobStatus("status").notNull().default("draft"),
    /** Shown in the homepage "Featured vacancies" section. */
    featured: boolean("featured").notNull().default(false),
    /** `/images/...` or an https:// URL; falls back to the department image. */
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("jobs_slug_uq").on(t.slug), index("jobs_status_idx").on(t.status)],
);

/** Roles an applicant may choose between when applying to a job (e.g. Bartender, Host). */
export const jobPositions = pgTable(
  "job_positions",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.positionId] })],
);

/**
 * QR codes are generated in-house. Each row stores the source configuration so
 * poster/event/social codes resolve to `/jobs/{slug}?source={source}`.
 */
export const jobQrCodes = pgTable(
  "job_qr_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    source: text("source").notNull().default(""),
    label: text("label").notNull(),
    scanCount: integer("scan_count").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("job_qr_codes_job_source_uq").on(t.jobId, t.source)],
);

/* -------------------------------------------------------------------------- */
/* Applicants & applications                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Canonical person record. Applications reference this so a future applicant
 * account (users.role = 'applicant') can attach via `userId` without migration.
 */
export const applicants = pgTable(
  "applicants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Lower-cased, trimmed. Used for matching returning applicants; not an identifier. */
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    lastAppliedAt: timestamp("last_applied_at", { withTimezone: true }),
    erasedAt: timestamp("erased_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("applicants_email_uq").on(t.email),
    uniqueIndex("applicants_user_uq").on(t.userId),
  ],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => applicants.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    positionId: uuid("position_id").references(() => positions.id, { onDelete: "set null" }),
    status: applicationStatus("status").notNull().default("new"),
    /** Snapshot of contact details at submission time. */
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    standoutQuality: text("standout_quality").notNull(),
    coverMessage: text("cover_message"),
    answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
    source: text("source"),
    consentText: text("consent_text").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    /** Client-generated idempotency key; prevents double submission. */
    submissionToken: text("submission_token").notNull(),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("applications_submission_token_uq").on(t.submissionToken),
    index("applications_job_idx").on(t.jobId),
    index("applications_applicant_idx").on(t.applicantId),
    index("applications_status_idx").on(t.status),
    index("applications_created_idx").on(t.createdAt),
  ],
);

export const applicationNotes = pgTable(
  "application_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("application_notes_application_idx").on(t.applicationId)],
);

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => applicants.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    type: documentType("type").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    storageProvider: storageProvider("storage_provider").notNull(),
    storageKey: text("storage_key").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("documents_applicant_idx").on(t.applicantId),
    index("documents_application_idx").on(t.applicationId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Future modules — foundations only, no MVP UI                               */
/* -------------------------------------------------------------------------- */

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => applicants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    issuer: text("issuer"),
    reference: text("reference"),
    issuedOn: date("issued_on"),
    expiresOn: date("expires_on"),
    ...timestamps,
  },
  (t) => [index("certificates_applicant_idx").on(t.applicantId), index("certificates_expiry_idx").on(t.expiresOn)],
);

export const employmentRecords = pgTable(
  "employment_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => applicants.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    positionId: uuid("position_id").references(() => positions.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    employmentTypeId: uuid("employment_type_id").references(() => employmentTypes.id, {
      onDelete: "set null",
    }),
    contractDocumentId: uuid("contract_document_id").references(() => documents.id, { onDelete: "set null" }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    ...timestamps,
  },
  (t) => [index("employment_records_applicant_idx").on(t.applicantId)],
);

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    positionId: uuid("position_id").references(() => positions.id, { onDelete: "set null" }),
    employmentRecordId: uuid("employment_record_id").references(() => employmentRecords.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"),
    ...timestamps,
  },
  (t) => [index("shifts_starts_idx").on(t.startsAt)],
);

export const salaryRecords = pgTable(
  "salary_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employmentRecordId: uuid("employment_record_id")
      .notNull()
      .references(() => employmentRecords.id, { onDelete: "cascade" }),
    /** Minor units (pence) to avoid floating-point money. */
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("GBP"),
    period: text("period").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    ...timestamps,
  },
  (t) => [index("salary_records_employment_idx").on(t.employmentRecordId)],
);

/* -------------------------------------------------------------------------- */
/* Notifications, audit, settings, rate limiting                              */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: notificationChannel("channel").notNull(),
    template: text("template").notNull(),
    recipientUserId: text("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
    recipientApplicantId: uuid("recipient_applicant_id").references(() => applicants.id, {
      onDelete: "cascade",
    }),
    recipientAddress: text("recipient_address"),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
    subject: text("subject"),
    status: notificationStatus("status").notNull().default("queued"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("notifications_application_idx").on(t.applicationId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    /** Never store secrets, CV contents or unnecessary personal data here. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_action_idx").on(t.action)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '1 hour'`),
});
