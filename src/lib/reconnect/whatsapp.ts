/**
 * Official WhatsApp Cloud API boundary only.
 * No WhatsApp Web automation / scraping.
 *
 * Coexistence: Meta supports connecting an existing WhatsApp Business *app*
 * number to Cloud API via Embedded Signup (“coexistence”) so the owner can
 * keep using +972 52-759-9399 in the app while sending templates via API.
 * This requires owner Meta Business verification, WABA setup, and an approved
 * marketing template — we do NOT migrate or disconnect the number here.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/
 */

export type WhatsappIntegrationStatus = {
  status: "READY" | "BLOCKED" | "NOT_CONFIGURED";
  coexistenceNote: string;
  blockers: string[];
  phoneNumberId: string | null;
  businessAccountId: string | null;
  templateName: string | null;
};

export function getWhatsappIntegrationStatus(): WhatsappIntegrationStatus {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null;
  const businessAccountId =
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || null;
  const templateName =
    process.env.WHATSAPP_RECONNECT_TEMPLATE_NAME?.trim() || null;

  const blockers: string[] = [];
  if (!token) blockers.push("WHATSAPP_CLOUD_API_TOKEN not set");
  if (!phoneNumberId) blockers.push("WHATSAPP_PHONE_NUMBER_ID not set");
  if (!businessAccountId) {
    blockers.push("WHATSAPP_BUSINESS_ACCOUNT_ID not set");
  }
  if (!templateName) {
    blockers.push(
      "WHATSAPP_RECONNECT_TEMPLATE_NAME not set — marketing outreach requires a Meta-approved template"
    );
  }
  if (process.env.WHATSAPP_COEXISTENCE_CONFIRMED !== "1") {
    blockers.push(
      "Owner has not confirmed coexistence onboarding for +972 52-759-9399 (set WHATSAPP_COEXISTENCE_CONFIRMED=1 only after Meta Embedded Signup succeeds without disconnecting the Business app)"
    );
  }

  const coexistenceNote =
    "Official Meta coexistence can keep the WhatsApp Business app and Cloud API on the same number (+972 52-759-9399). Do not migrate or delete the app number without explicit owner approval. App messages remain free; Cloud API template messages are billed by Meta per delivered message.";

  if (blockers.length === 0) {
    return {
      status: "READY",
      coexistenceNote,
      blockers: [],
      phoneNumberId,
      businessAccountId,
      templateName,
    };
  }

  return {
    status: token || phoneNumberId ? "BLOCKED" : "NOT_CONFIGURED",
    coexistenceNote,
    blockers,
    phoneNumberId,
    businessAccountId,
    templateName,
  };
}

export type WhatsappSendResult = {
  accepted: boolean;
  providerMessageId: string | null;
  /** Delivery is NEVER claimed here — only provider accept / queue. */
  delivered: false;
  error?: string;
  provider: "whatsapp_cloud_api";
};

/**
 * Send an approved template message via Cloud API.
 * Returns accepted=true only when Meta accepts the request.
 * delivered is always false until a webhook confirms delivery.
 */
export async function sendWhatsappTemplate(input: {
  toE164: string;
  templateName: string;
  languageCode?: string;
  bodyTextFallback?: string;
}): Promise<WhatsappSendResult> {
  const status = getWhatsappIntegrationStatus();
  if (status.status !== "READY") {
    return {
      accepted: false,
      providerMessageId: null,
      delivered: false,
      error: `WhatsApp BLOCKED: ${status.blockers.join("; ")}`,
      provider: "whatsapp_cloud_api",
    };
  }

  const token = process.env.WHATSAPP_CLOUD_API_TOKEN!.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const to = input.toE164.replace(/^\+/, "");

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.languageCode || "en" },
    },
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const json = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      return {
        accepted: false,
        providerMessageId: null,
        delivered: false,
        error: json.error?.message || `HTTP ${response.status}`,
        provider: "whatsapp_cloud_api",
      };
    }
    return {
      accepted: true,
      providerMessageId: json.messages?.[0]?.id ?? null,
      delivered: false,
      provider: "whatsapp_cloud_api",
    };
  } catch (err) {
    return {
      accepted: false,
      providerMessageId: null,
      delivered: false,
      error: err instanceof Error ? err.message : "WhatsApp send failed",
      provider: "whatsapp_cloud_api",
    };
  }
}

/** Israel marketing template estimate (Meta rate card, USD per delivered msg). */
export const WHATSAPP_IL_MARKETING_USD = 0.0353;
