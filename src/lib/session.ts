import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/db/schema";
import { auth } from "./auth";

export type StaffUser = { id: string; name: string; email: string; role: Exclude<UserRole, "applicant"> };

const STAFF_ROLES = ["owner", "admin", "recruiter"] as const;

export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as
    | { id: string; name: string; email: string; role?: string; active?: boolean }
    | undefined;
  if (!user || user.active === false) return null;
  if (!STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number])) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as StaffUser["role"] };
});

/** Server-side guard for admin pages. Every admin page and action calls this. */
export async function requireStaff(): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Owners and admins manage configuration and staff; recruiters manage jobs and applications. */
export async function requireAdmin(): Promise<StaffUser> {
  const user = await requireStaff();
  if (user.role === "recruiter") redirect("/admin?error=forbidden");
  return user;
}

export function canManageSettings(user: StaffUser) {
  return user.role === "owner" || user.role === "admin";
}
