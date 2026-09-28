"use client";

import { useState } from "react";
import type { PublicStorageSettings } from "@/lib/settings";
import { cx, Field, Input } from "@/components/ui";

const SAVED = "•••••••• saved — leave blank to keep";

export function StorageFields({ settings, allowLocal }: { settings: PublicStorageSettings; allowLocal: boolean }) {
  const [provider, setProvider] = useState<PublicStorageSettings["provider"]>(settings.provider);
  const options = [
    { value: "cloudinary", label: "Cloudinary" },
    { value: "s3", label: "Amazon S3" },
    ...(allowLocal || settings.provider === "local" ? [{ value: "local", label: "Local disk (development only)" }] : []),
  ] as { value: PublicStorageSettings["provider"]; label: string }[];

  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-stone-800">Storage provider</legend>
        <div className="flex flex-wrap gap-3">
          {options.map((o) => (
            <label
              key={o.value}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-sm",
                provider === o.value ? "border-brand bg-stone-50 font-semibold" : "border-stone-300",
              )}
            >
              <input
                type="radio"
                name="provider"
                value={o.value}
                checked={provider === o.value}
                onChange={() => setProvider(o.value)}
                className="accent-brand"
              />
              {o.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-stone-500">
          Applicant files are stored privately and are only downloadable through the dashboard. Secrets are encrypted before being saved and are never
          sent back to the browser.
        </p>
      </fieldset>

      {/* Both sections stay in the form so switching provider never wipes the other configuration. */}
      <div className={cx("space-y-5", provider !== "cloudinary" && "hidden")}>
        <h3 className="font-semibold text-stone-900">Cloudinary</h3>
        <Field label="Cloud name" htmlFor="c-cloudName" required>
          <Input id="c-cloudName" name="cloudinary.cloudName" defaultValue={settings.cloudinary.cloudName} autoComplete="off" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="API key" htmlFor="c-apiKey" required>
            <Input id="c-apiKey" name="cloudinary.apiKey" defaultValue={settings.cloudinary.apiKey} autoComplete="off" />
          </Field>
          <Field label="API secret" htmlFor="c-apiSecret" required>
            <Input
              id="c-apiSecret"
              name="cloudinary.apiSecret"
              type="password"
              autoComplete="new-password"
              placeholder={settings.cloudinary.apiSecretSet ? SAVED : ""}
            />
          </Field>
        </div>
        <Field label="Folder" htmlFor="c-folder" hint="Uploads are placed under this folder.">
          <Input id="c-folder" name="cloudinary.folder" defaultValue={settings.cloudinary.folder} />
        </Field>
      </div>

      <div className={cx("space-y-5", provider !== "s3" && "hidden")}>
        <h3 className="font-semibold text-stone-900">Amazon S3</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Bucket name" htmlFor="s-bucket" required>
            <Input id="s-bucket" name="s3.bucket" defaultValue={settings.s3.bucket} autoComplete="off" />
          </Field>
          <Field label="Region" htmlFor="s-region" required hint="London is eu-west-2.">
            <Input id="s-region" name="s3.region" defaultValue={settings.s3.region} autoComplete="off" />
          </Field>
          <Field label="Access key ID" htmlFor="s-accessKeyId" required>
            <Input id="s-accessKeyId" name="s3.accessKeyId" defaultValue={settings.s3.accessKeyId} autoComplete="off" />
          </Field>
          <Field label="Secret access key" htmlFor="s-secret" required>
            <Input
              id="s-secret"
              name="s3.secretAccessKey"
              type="password"
              autoComplete="new-password"
              placeholder={settings.s3.secretAccessKeySet ? SAVED : ""}
            />
          </Field>
        </div>
        <Field label="Key prefix" htmlFor="s-prefix" hint="Objects are stored under this path in the bucket.">
          <Input id="s-prefix" name="s3.prefix" defaultValue={settings.s3.prefix} />
        </Field>
        <Field label="CloudFront / CDN URL" htmlFor="s-cdn" hint="For future public assets only. Private applicant documents always use short-lived signed S3 links.">
          <Input id="s-cdn" name="s3.cdnUrl" type="url" defaultValue={settings.s3.cdnUrl} placeholder="https://" />
        </Field>
        <p className="text-sm text-stone-500">
          The IAM user needs <code>s3:PutObject</code>, <code>s3:GetObject</code>, <code>s3:DeleteObject</code> and <code>s3:ListBucket</code> on this bucket only.
          Keep “Block all public access” switched on.
        </p>
      </div>

      {provider === "local" && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Files are written to <code>.data/uploads</code> on this machine. This option is disabled in production.
        </p>
      )}
    </>
  );
}
