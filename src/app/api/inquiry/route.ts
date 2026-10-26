import { NextResponse } from "next/server";
import { sendInquiryEmail } from "@/lib/inquiry-email";
import { saveInquiry } from "@/lib/inquiry-store";
import type { InquiryPayload } from "@/lib/inquiry-types";
import { inquiryWhatsAppUrl } from "@/lib/inquiry-whatsapp";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { createLead } from "@/lib/leads/store";
import type { Attribution } from "@/lib/leads/types";

function sanitizeAttribution(raw: unknown): Attribution | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  const pick = (k: string) =>
    typeof a[k] === "string" ? (a[k] as string).trim() || undefined : undefined;
  return {
    utmSource: pick("utmSource") || pick("utm_source"),
    utmMedium: pick("utmMedium") || pick("utm_medium"),
    utmCampaign: pick("utmCampaign") || pick("utm_campaign"),
    utmContent: pick("utmContent") || pick("utm_content"),
    utmTerm: pick("utmTerm") || pick("utm_term"),
    gclid: pick("gclid"),
    fbclid: pick("fbclid"),
    referrer: pick("referrer"),
    landingPage: pick("landingPage"),
    inquiryPage: pick("inquiryPage"),
    campaignSlug: pick("campaignSlug") || pick("campaign"),
  };
}

export async function POST(request: Request) {
  let body: InquiryPayload & { attribution?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json(
      { error: "Name and email are required." },
      { status: 400 },
    );
  }

  const attribution = sanitizeAttribution(body.attribution);

  const payload: InquiryPayload = {
    name: body.name.trim(),
    email: body.email.trim(),
    phone: body.phone?.trim(),
    apartment: body.apartment?.trim(),
    apartmentSlug: body.apartmentSlug?.trim(),
    propertyIds: Array.isArray(body.propertyIds)
      ? body.propertyIds.map(String)
      : undefined,
    checkin: body.checkin?.trim(),
    checkout: body.checkout?.trim(),
    guests: body.guests?.trim(),
    bedroomsRequested: body.bedroomsRequested?.trim(),
    destination: body.destination?.trim(),
    requirements: body.requirements?.trim(),
    notes: body.notes?.trim(),
    message: body.message?.trim() || body.notes?.trim(),
    attribution,
    consentMarketing: Boolean(body.consentMarketing),
  };

  const delivery = await sendInquiryEmail(payload);

  let leadId: string | undefined;
  let leadStored = false;

  if (FEATURE_FLAGS.durableLeads) {
    try {
      const lead = await createLead({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        apartment: payload.apartment,
        apartmentSlug: payload.apartmentSlug,
        propertyIds: payload.propertyIds,
        checkin: payload.checkin,
        checkout: payload.checkout,
        guests: payload.guests,
        bedroomsRequested: payload.bedroomsRequested,
        destination: payload.destination,
        requirements: payload.requirements,
        notes: payload.notes,
        message: payload.message,
        attribution: payload.attribution,
        consentMarketing: payload.consentMarketing,
        emailSent: delivery.sent,
        emailProvider: delivery.provider,
        emailMessageId: delivery.messageId,
        tags: attribution?.campaignSlug
          ? [`campaign:${attribution.campaignSlug}`]
          : [],
      });
      leadId = lead.id;
      leadStored = true;
    } catch (err) {
      console.error("Failed to create CRM lead:", err);
    }
  }

  let inquiryLegacyStored = false;
  try {
    await saveInquiry(payload, delivery.sent, leadId);
    inquiryLegacyStored = true;
  } catch (err) {
    console.error("Failed to store inquiry:", err);
  }

  const stored = leadStored || inquiryLegacyStored;

  // Never hard-fail the guest journey: email and/or WhatsApp keep the commercial path open.
  // Durable CRM recovery on Vercel still requires Upstash (documented blocker).
  if (delivery.sent) {
    return NextResponse.json({
      success: true,
      emailSent: true,
      provider: delivery.provider,
      messageId: delivery.messageId,
      leadId,
      stored,
      inquiryLegacyStored,
    });
  }

  return NextResponse.json({
    success: true,
    emailSent: false,
    leadId,
    stored,
    whatsappUrl: inquiryWhatsAppUrl(payload),
    storageWarning: stored
      ? undefined
      : "Inquiry could not be persisted server-side. Configure UPSTASH_REDIS_REST_URL/TOKEN for durable CRM recovery.",
  });
}
