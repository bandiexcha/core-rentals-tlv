import nodemailer from "nodemailer";
import { SITE } from "@/lib/constants";

export type OutboundEmailResult = {
  sent: boolean;
  provider: "gmail" | "resend" | null;
  messageId: string | null;
  error?: string;
};

function senderIdentity(): { from: string; replyTo: string } {
  const fromEmail =
    process.env.RECONNECT_FROM_EMAIL?.trim() ||
    process.env.GMAIL_USER?.trim() ||
    SITE.inquiryEmail;
  const fromName =
    process.env.RECONNECT_FROM_NAME?.trim() || "Avishay Ben Eli · Core Rentals TLV";
  return {
    from: `${fromName} <${fromEmail}>`,
    replyTo: SITE.inquiryEmail,
  };
}

export function getEmailSenderStatus(): {
  status: "READY" | "BLOCKED" | "PARTIAL";
  blockers: string[];
  senderIdentity: string;
} {
  const blockers: string[] = [];
  const hasGmail = Boolean(process.env.GMAIL_APP_PASSWORD?.trim());
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const { from } = senderIdentity();

  if (!hasGmail && !hasResend) {
    blockers.push(
      "No outbound email provider: set GMAIL_APP_PASSWORD and/or RESEND_API_KEY."
    );
  }
  if (hasResend && !(process.env.RECONNECT_FROM_EMAIL || process.env.RESEND_FROM)) {
    blockers.push(
      "Resend is present but RECONNECT_FROM_EMAIL / RESEND_FROM should be a verified domain sender for bulk customer mail."
    );
  }

  return {
    status: blockers.length === 0 ? "READY" : hasGmail || hasResend ? "PARTIAL" : "BLOCKED",
    blockers,
    senderIdentity: from,
  };
}

async function sendViaGmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<OutboundEmailResult | null> {
  const user = process.env.GMAIL_USER?.trim() || SITE.inquiryEmail;
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!pass) return null;

  const { replyTo } = senderIdentity();
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Avishay Ben Eli · Core Rentals TLV" <${user}>`,
      to: input.to,
      replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
      headers: {
        "List-Unsubscribe": `<mailto:${SITE.inquiryEmail}?subject=unsubscribe>`,
      },
    });
    return {
      sent: true,
      provider: "gmail",
      messageId: String(info.messageId ?? ""),
    };
  } catch (err) {
    return {
      sent: false,
      provider: "gmail",
      messageId: null,
      error: err instanceof Error ? err.message : "Gmail send failed",
    };
  }
}

async function sendViaResend(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<OutboundEmailResult | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  const from =
    process.env.RECONNECT_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "Core Rentals TLV <onboarding@resend.dev>";
  const { replyTo } = senderIdentity();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        reply_to: replyTo,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return {
        sent: false,
        provider: "resend",
        messageId: null,
        error: `Resend HTTP ${response.status}: ${body.slice(0, 200)}`,
      };
    }
    const result = (await response.json()) as { id?: string };
    return {
      sent: true,
      provider: "resend",
      messageId: result.id ?? null,
    };
  } catch (err) {
    return {
      sent: false,
      provider: "resend",
      messageId: null,
      error: err instanceof Error ? err.message : "Resend send failed",
    };
  }
}

/** Send one reconnect email. Prefer Gmail (owner mailbox), then Resend. */
export async function sendReconnectEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<OutboundEmailResult> {
  const gmail = await sendViaGmail(input);
  if (gmail?.sent) return gmail;
  if (gmail && !gmail.sent && gmail.error) {
    // try resend next
  }

  const resend = await sendViaResend(input);
  if (resend?.sent) return resend;

  return {
    sent: false,
    provider: gmail?.provider || resend?.provider || null,
    messageId: null,
    error:
      resend?.error ||
      gmail?.error ||
      "No email provider available for outbound reconnect mail.",
  };
}
