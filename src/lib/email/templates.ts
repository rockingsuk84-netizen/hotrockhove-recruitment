import "server-only";
import { fillTemplate, type NotificationSettings, type SiteSettings } from "@/lib/settings";

export type RenderedEmail = { subject: string; html: string; text: string };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Shared branded wrapper so every template (current and future) looks consistent. */
function layout(site: SiteSettings, bodyHtml: string, preheader = ""): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:${site.primaryColour};color:#fff;padding:18px 24px;font-size:18px;font-weight:bold">${esc(site.brandName)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#78716c;border-top:1px solid #e7e5e4">${esc(site.footerText || site.brandName)}</td></tr>
</table></td></tr></table></body></html>`;
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function applicantConfirmationEmail(
  site: SiteSettings,
  n: NotificationSettings,
  vars: { applicantName: string; jobTitle: string },
): RenderedEmail {
  const all = { ...vars, brandName: site.brandName };
  const body = fillTemplate(n.applicantConfirmationBody, all);
  return {
    subject: fillTemplate(n.applicantConfirmationSubject, all),
    html: layout(site, paragraphs(body), `Application received: ${vars.jobTitle}`),
    text: body,
  };
}

export function adminNewApplicationEmail(
  site: SiteSettings,
  n: NotificationSettings,
  vars: { applicantName: string; jobTitle: string; position: string | null; email: string; phone: string; source: string | null; dashboardUrl: string },
): RenderedEmail {
  const all = { applicantName: vars.applicantName, jobTitle: vars.jobTitle, brandName: site.brandName };
  const rows: [string, string][] = [
    ["Applicant", vars.applicantName],
    ["Job", vars.jobTitle],
    ...(vars.position ? ([["Role", vars.position]] as [string, string][]) : []),
    ["Email", vars.email],
    ["Phone", vars.phone],
    ...(vars.source ? ([["Source", vars.source]] as [string, string][]) : []),
  ];
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#78716c">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join("")}</table>`;
  const button = `<a href="${esc(vars.dashboardUrl)}" style="display:inline-block;background:${site.accentColour};color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">View application</a>`;
  return {
    subject: fillTemplate(n.adminNotificationSubject, all),
    html: layout(site, `<p style="margin:0 0 14px">A new application has been submitted.</p>${table}${button}<p style="margin:18px 0 0;font-size:12px;color:#78716c">Sign-in is required. The CV is only available from the dashboard.</p>`, `New application for ${vars.jobTitle}`),
    text: `A new application has been submitted.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nView application (sign-in required): ${vars.dashboardUrl}`,
  };
}

function button(site: SiteSettings, url: string, label: string) {
  return `<p style="margin:22px 0"><a href="${esc(url)}" style="display:inline-block;background:${site.accentColour};color:#111;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">${esc(label)}</a></p>`;
}

/** Invitation for a new staff member to set their own password. */
export function staffInviteEmail(
  site: SiteSettings,
  vars: { name: string; inviterName: string; url: string; expiresHours: number },
): RenderedEmail {
  const intro = `Hello ${vars.name},\n\n${vars.inviterName} has added you to the ${site.brandName} recruitment dashboard. Set your password to get started.`;
  const note = `This link works once and expires in ${vars.expiresHours} hours. If it has expired, ask an administrator to send a new one or use "Forgot password?" on the sign-in page.\n\nIf you weren't expecting this email, you can ignore it.`;
  return {
    subject: `You've been invited to the ${site.brandName} dashboard`,
    html: layout(site, paragraphs(intro) + button(site, vars.url, "Set your password") + paragraphs(note), "Set your password to access the dashboard"),
    text: `${intro}\n\nSet your password: ${vars.url}\n\n${note}`,
  };
}

/** Password reset link for an existing staff member. */
export function passwordResetEmail(site: SiteSettings, vars: { name: string; url: string; expiresMinutes: number }): RenderedEmail {
  const intro = `Hello ${vars.name},\n\nWe received a request to reset the password for your ${site.brandName} dashboard account.`;
  const note = `This link works once and expires in ${vars.expiresMinutes} minutes. Resetting your password signs you out on other devices.\n\nIf you didn't request this, you can ignore this email; your password won't change.`;
  return {
    subject: `Reset your ${site.brandName} dashboard password`,
    html: layout(site, paragraphs(intro) + button(site, vars.url, "Choose a new password") + paragraphs(note), "Reset your dashboard password"),
    text: `${intro}\n\nChoose a new password: ${vars.url}\n\n${note}`,
  };
}
