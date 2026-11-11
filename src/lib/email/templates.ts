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

/** A form for an applicant to complete, with their private link. */
export function formRequestEmail(
  site: SiteSettings,
  vars: { applicantName: string; formTitle: string; intro: string; url: string; expiresOn: string },
): RenderedEmail {
  const intro = `Hello ${vars.applicantName},\n\nThank you for applying to ${site.brandName}. Please complete our short form: ${vars.formTitle}.${vars.intro ? `\n\n${vars.intro}` : ""}`;
  const note = `This link is personal to you, so please don't share it. It can be used once and works until ${vars.expiresOn}.`;
  return {
    subject: `${site.brandName}: please complete "${vars.formTitle}"`,
    html: layout(site, paragraphs(intro) + button(site, vars.url, "Complete the form") + paragraphs(note), `Please complete: ${vars.formTitle}`),
    text: `${intro}\n\nComplete the form: ${vars.url}\n\n${note}`,
  };
}

/** A copy of what the applicant submitted, for their records. */
export function formResponseCopyEmail(
  site: SiteSettings,
  vars: { applicantName: string; formTitle: string; rows: { question: string; answer: string }[]; cvNote: string | null },
): RenderedEmail {
  const intro = `Hello ${vars.applicantName},\n\nThank you for completing "${vars.formTitle}". Here is a copy of your answers for your records.`;
  const outro = `If anything is wrong, just reply to this email and let us know.`;
  const all = vars.cvNote ? [...vars.rows, { question: "CV", answer: vars.cvNote }] : vars.rows;
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;font-size:14px;border-collapse:collapse">${all
    .map(
      (r) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#78716c;vertical-align:top;border-top:1px solid #e7e5e4;width:45%">${esc(r.question)}</td><td style="padding:8px 0;vertical-align:top;border-top:1px solid #e7e5e4">${esc(r.answer).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("")}</table>`;
  return {
    subject: `Your answers: ${vars.formTitle}`,
    html: layout(site, paragraphs(intro) + table + paragraphs(outro), `Copy of your answers: ${vars.formTitle}`),
    text: `${intro}\n\n${all.map((r) => `${r.question}\n${r.answer}`).join("\n\n")}\n\n${outro}`,
  };
}

function detailTable(rows: [string, string][]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;font-size:15px;border-collapse:collapse">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#78716c;vertical-align:top;border-top:1px solid #e7e5e4;width:30%">${esc(k)}</td><td style="padding:8px 0;vertical-align:top;border-top:1px solid #e7e5e4">${esc(v).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("")}</table>`;
}

/** Interview invitation, or an update when it has been rescheduled. */
export function interviewInviteEmail(
  site: SiteSettings,
  vars: {
    applicantName: string;
    jobTitle: string | null;
    when: string;
    durationMinutes: number;
    mode: "in_person" | "online" | "phone";
    location: string | null;
    meetingLink: string | null;
    phone: string | null;
    contactName: string | null;
    notes: string | null;
    updated: boolean;
  },
): RenderedEmail {
  const role = vars.jobTitle ? ` for the ${vars.jobTitle} role` : "";
  const intro = vars.updated
    ? `Hello ${vars.applicantName},\n\nYour interview${role} at ${site.brandName} has changed. Here are the updated details. Please ignore any earlier times we sent.`
    : `Hello ${vars.applicantName},\n\nThank you for completing our form. We'd like to invite you to an interview${role} at ${site.brandName}.`;
  const rows: [string, string][] = [
    ["When", `${vars.when} (UK time)`],
    ["Length", `About ${vars.durationMinutes} minutes`],
  ];
  if (vars.mode === "in_person") rows.push(["Where", vars.location ?? ""]);
  if (vars.mode === "online") rows.push(["How", "Online video call (link below)"]);
  if (vars.mode === "phone") rows.push(["How", vars.phone ? `We'll phone you on ${vars.phone}` : "We'll phone you"]);
  if (vars.contactName) rows.push([vars.mode === "in_person" ? "Ask for" : "With", vars.contactName]);
  if (vars.notes) rows.push(["Notes", vars.notes]);
  const join = vars.mode === "online" && vars.meetingLink ? button(site, vars.meetingLink, "Join the interview") : "";
  const outro = `If you can't make this time, please reply to this email and we'll find another.`;
  return {
    subject: vars.updated ? `Updated interview details: ${site.brandName}` : `Interview invitation: ${site.brandName}`,
    html: layout(site, paragraphs(intro) + detailTable(rows) + join + paragraphs(outro), `Interview: ${vars.when}`),
    text: `${intro}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}${vars.mode === "online" && vars.meetingLink ? `\nJoin: ${vars.meetingLink}` : ""}\n\n${outro}`,
  };
}

export function interviewCancelledEmail(site: SiteSettings, vars: { applicantName: string; when: string }): RenderedEmail {
  const body = `Hello ${vars.applicantName},\n\nWe've had to cancel your interview with ${site.brandName} on ${vars.when}. We're sorry for any inconvenience.\n\nWe'll be in touch if we arrange another time. If you have any questions, just reply to this email.`;
  return { subject: `Interview cancelled: ${site.brandName}`, html: layout(site, paragraphs(body), "Your interview has been cancelled"), text: body };
}

/** Job offer. Only sent for "Offer"; applicants on hold or rejected are not emailed. */
export function offerEmail(site: SiteSettings, vars: { applicantName: string; jobTitle: string | null; message: string | null }): RenderedEmail {
  const role = vars.jobTitle ? ` the ${vars.jobTitle} role` : " a role";
  const intro = `Hello ${vars.applicantName},\n\nGreat news: we're delighted to offer you${role} at ${site.brandName}. Thank you for taking the time to meet us.`;
  const outro = `Please reply to this email to accept or if you have any questions. We look forward to welcoming you to the team.`;
  return {
    subject: `Job offer from ${site.brandName}`,
    html: layout(site, paragraphs(intro) + (vars.message ? paragraphs(vars.message) : "") + paragraphs(outro), `We'd like to offer you${role}`),
    text: `${intro}${vars.message ? `\n\n${vars.message}` : ""}\n\n${outro}`,
  };
}
