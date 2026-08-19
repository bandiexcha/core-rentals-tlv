import nodemailer from "nodemailer";
import { SITE } from "@/lib/constants";
import type { InquiryPayload } from "@/lib/inquiry-types";

function inquirySubject(apartment?: string): string {
  if (apartment?.trim()) {
    return `Core Rentals TLV Inquiry: ${apartment.trim()}`;
  }
  return "Core Rentals TLV — Availability Inquiry";
}

export function formatInquiryEmail(data: InquiryPayload): string {
  return [
    "New availability inquiry — Core Rentals TLV",
    "",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone?.trim() || "—"}`,
    "",
    `Apartment: ${data.apartment?.trim() || "Any from catalog"}`,
    `Check-in: ${data.checkin?.trim() || "Flexible"}`,
    `Check-out: ${data.checkout?.trim() || "Flexible"}`,
    `Guests: ${data.guests?.trim() || "—"}`,
    "",
    "Notes:",
    data.notes?.trim() || "—",
  ].join("\n");
}

export type InquiryEmailEvidence = {
  sent: boolean;
  provider: "resend" | "gmail" | "web3forms" | null;
  messageId: string | null;
};

async function sendViaResend(data: InquiryPayload): Promise<InquiryEmailEvidence | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const from =
    process.env.RESEND_FROM ?? "Core Rentals TLV <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [SITE.inquiryEmail],
      reply_to: data.email,
      subject: inquirySubject(data.apartment),
      text: formatInquiryEmail(data),
    }),
  });

  if (!response.ok) return null;
  const result = (await response.json()) as { id?: string };
  return {
    sent: true,
    provider: "resend",
    messageId: result.id ?? null,
  };
}

async function sendViaGmail(data: InquiryPayload): Promise<InquiryEmailEvidence | null> {
  const user = process.env.GMAIL_USER ?? SITE.inquiryEmail;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) return null;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: `"Core Rentals TLV" <${user}>`,
    to: SITE.inquiryEmail,
    replyTo: data.email,
    subject: inquirySubject(data.apartment),
    text: formatInquiryEmail(data),
  });

  return {
    sent: true,
    provider: "gmail",
    messageId: String(info.messageId ?? ""),
  };
}

async function sendViaWeb3Forms(data: InquiryPayload): Promise<InquiryEmailEvidence | null> {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) return null;

  const response = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: accessKey,
      subject: inquirySubject(data.apartment),
      from_name: data.name,
      email: data.email,
      name: data.name,
      phone: data.phone ?? "",
      apartment: data.apartment ?? "Any from catalog",
      checkin: data.checkin ?? "Flexible",
      checkout: data.checkout ?? "Flexible",
      guests: data.guests ?? "",
      notes: data.notes ?? "",
      message: formatInquiryEmail(data),
    }),
  });

  if (!response.ok) return null;
  const result = (await response.json()) as { success?: boolean; submission_id?: string };
  if (result.success !== true) return null;
  return {
    sent: true,
    provider: "web3forms",
    messageId: result.submission_id ?? null,
  };
}

export async function sendInquiryEmail(
  data: InquiryPayload
): Promise<InquiryEmailEvidence> {
  const providers = [sendViaResend, sendViaGmail, sendViaWeb3Forms];

  for (const provider of providers) {
    try {
      const result = await provider(data);
      if (result?.sent) return result;
    } catch {
      // Try next provider
    }
  }

  return { sent: false, provider: null, messageId: null };
}
