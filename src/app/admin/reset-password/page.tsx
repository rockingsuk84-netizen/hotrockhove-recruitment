import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { getSetting } from "@/lib/settings";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/admin/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const invite = sp.invite === "1";
  const site = await getSetting("site");

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-xl font-semibold text-stone-900">{site.brandName}</p>
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900">{invite ? "Welcome: set your password" : "Choose a new password"}</h1>
          {token ? (
            <>
              <p className="mt-1 text-sm text-stone-600">Use at least 12 characters. A short phrase of several words is easy to remember and hard to guess.</p>
              <ResetForm token={token} invite={invite} />
            </>
          ) : (
            <div className="mt-4">
              <Alert tone="error">This link is incomplete. Open the link from your email again, or request a new one.</Alert>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/admin/forgot-password" className="font-medium text-stone-700 hover:underline">
            Need a new link?
          </Link>
        </p>
      </div>
    </div>
  );
}
