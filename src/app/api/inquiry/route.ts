import { NextResponse } from "next/server";
import { sendInquiryEmail } from "@/lib/inquiry-email";
import { saveInquiry } from "@/lib/inquiry-store";
import type { InquiryPayload } from "@/lib/inquiry-types";
import { inquiryWhatsAppUrl } from "@/lib/inquiry-whatsapp";

export async function POST(request: Request) {
  let body: InquiryPayload;

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

  const payload: InquiryPayload = {
    name: body.name.trim(),
    email: body.email.trim(),
    phone: body.phone?.trim(),
    apartment: body.apartment?.trim(),
    checkin: body.checkin?.trim(),
    checkout: body.checkout?.trim(),
    guests: body.guests?.trim(),
    notes: body.notes?.trim(),
  };

  const delivery = await sendInquiryEmail(payload);

  try {
    await saveInquiry(payload, delivery.sent);
  } catch (err) {
    console.error("Failed to store inquiry:", err);
    return NextResponse.json(
      { error: "Unable to save inquiry. Please contact us on WhatsApp." },
      { status: 500 },
    );
  }

  if (delivery.sent) {
    return NextResponse.json({
      success: true,
      emailSent: true,
      provider: delivery.provider,
      messageId: delivery.messageId,
    });
  }

  return NextResponse.json({
    success: true,
    emailSent: false,
    whatsappUrl: inquiryWhatsAppUrl(payload),
  });
}
