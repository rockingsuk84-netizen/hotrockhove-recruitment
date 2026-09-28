import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type OutgoingEmail = { to: string[]; subject: string; html: string; text: string; replyTo?: string };
export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export interface EmailTransport {
  readonly name: string;
  send(msg: OutgoingEmail): Promise<SendResult>;
}

function resendTransport(apiKey: string): EmailTransport {
  const client = new Resend(apiKey);
  return {
    name: "resend",
    async send(msg) {
      const { data, error } = await client.emails.send({
        from: env().EMAIL_FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: msg.replyTo,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data?.id ?? null };
    },
  };
}

/** Development fallback: logs that an email would be sent, without the body. */
const consoleTransport: EmailTransport = {
  name: "console",
  async send(msg) {
    console.info(`[email:console] "${msg.subject}" → ${msg.to.length} recipient(s). Set RESEND_API_KEY to deliver.`);
    return { ok: true, id: null };
  },
};

export function getTransport(): EmailTransport {
  const key = env().RESEND_API_KEY;
  if (key) return resendTransport(key);
  if (env().NODE_ENV === "production") {
    return { name: "none", send: async () => ({ ok: false, error: "RESEND_API_KEY is not configured" }) };
  }
  return consoleTransport;
}
