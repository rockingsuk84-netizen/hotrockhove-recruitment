import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSetting } from "@/lib/settings";
import { getStaffUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await getStaffUser()) redirect("/admin");
  const site = await getSetting("site");
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-xl font-semibold text-stone-900">{site.brandName}</p>
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900">Sign in to the dashboard</h1>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
