import { NextResponse } from "next/server";
import { listContacts, recordDelivery, saveCampaign, getCampaign } from "@/lib/reconnect/store";

/**
 * Meta Cloud API webhook.
 * Delivery is only marked when Meta sends a status=delivered event.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  let body: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{
            id?: string;
            status?: string;
            recipient_id?: string;
          }>;
          messages?: Array<{ from?: string; type?: string; text?: { body?: string } }>;
        };
      }>;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contacts = await listContacts();

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const statuses = change.value?.statuses || [];
      for (const st of statuses) {
        if (!st.id || !st.status) continue;
        const contact = contacts.find((c) =>
          c.delivery.some((d) => d.providerMessageId === st.id)
        );
        if (!contact) continue;
        const prior = contact.delivery.find((d) => d.providerMessageId === st.id);
        if (!prior) continue;

        if (st.status === "delivered") {
          await recordDelivery(contact.id, {
            campaignId: prior.campaignId,
            channel: "whatsapp",
            status: "delivered",
            provider: "whatsapp_cloud_api",
            providerMessageId: st.id,
            providerConfirmed: true,
          });
          const campaign = await getCampaign(prior.campaignId);
          if (campaign) {
            campaign.deliveredCount += 1;
            await saveCampaign(campaign);
          }
        } else if (st.status === "failed") {
          await recordDelivery(contact.id, {
            campaignId: prior.campaignId,
            channel: "whatsapp",
            status: "failed",
            provider: "whatsapp_cloud_api",
            providerMessageId: st.id,
            providerConfirmed: true,
            error: "provider_status_failed",
          });
        }
      }

      const messages = change.value?.messages || [];
      for (const msg of messages) {
        const text = (msg.text?.body || "").trim().toUpperCase();
        if (!msg.from) continue;
        const phone = msg.from.startsWith("+") ? msg.from : `+${msg.from}`;
        const contact = contacts.find((c) => c.phoneE164 === phone);
        if (!contact) continue;
        if (["STOP", "UNSUBSCRIBE", "CANCEL", "OPT OUT", "OPTOUT"].includes(text)) {
          await recordDelivery(contact.id, {
            campaignId: contact.lastWhatsappCampaignId || "inbound",
            channel: "whatsapp",
            status: "opted_out",
            provider: "whatsapp_cloud_api",
            providerMessageId: null,
            providerConfirmed: true,
          });
        } else {
          await recordDelivery(contact.id, {
            campaignId: contact.lastWhatsappCampaignId || "inbound",
            channel: "whatsapp",
            status: "replied",
            provider: "whatsapp_cloud_api",
            providerMessageId: null,
            providerConfirmed: true,
          });
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
