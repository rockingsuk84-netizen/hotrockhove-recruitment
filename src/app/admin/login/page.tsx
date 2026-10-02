import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui";
import { getSetting } from "@/lib/settings";
import { getStaffUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  if (await getStaffUser()) redirect("/admin");
  const site = await getSetting("site");
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-xl font-semibold text-stone-900">{site.brandName}</p>
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900">Sign in to the dashboard</h1>
          {(sp.welcome || sp.reset) && (
            <div className="mt-4">
              <Alert tone="success">{sp.welcome ? "Your password is set. Sign in to get started." : "Your password has been changed. Sign in with your new password."}</Alert>
            </div>
          )}
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/admin/forgot-password" className="font-medium text-stone-700 hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
