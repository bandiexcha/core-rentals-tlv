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

async function sendViaResend(data: InquiryPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

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

  return response.ok;
}

async function sendViaGmail(data: InquiryPayload): Promise<boolean> {
  const user = process.env.GMAIL_USER ?? SITE.inquiryEmail;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) return false;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"Core Rentals TLV" <${user}>`,
    to: SITE.inquiryEmail,
    replyTo: data.email,
    subject: inquirySubject(data.apartment),
    text: formatInquiryEmail(data),
  });

  return true;
}

async function sendViaWeb3Forms(data: InquiryPayload): Promise<boolean> {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) return false;

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

  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

export async function sendInquiryEmail(data: InquiryPayload): Promise<boolean> {
  const providers = [sendViaResend, sendViaGmail, sendViaWeb3Forms];

  for (const provider of providers) {
    try {
      if (await provider(data)) return true;
    } catch {
      // Try next provider
    }
  }

  return false;
}
