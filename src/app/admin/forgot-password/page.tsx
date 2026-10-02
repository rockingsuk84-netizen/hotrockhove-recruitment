import type { Metadata } from "next";
import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default async function ForgotPasswordPage() {
  const site = await getSetting("site");
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-xl font-semibold text-stone-900">{site.brandName}</p>
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900">Reset your password</h1>
          <p className="mt-1 text-sm text-stone-600">Enter your work email and we&apos;ll send you a link to choose a new password.</p>
          <ForgotForm />
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/admin/login" className="font-medium text-stone-700 hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
