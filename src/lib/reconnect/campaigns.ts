import { randomUUID } from "crypto";
import { absoluteUrl } from "@/lib/seo";
import { estimateCampaignCost } from "@/lib/reconnect/costs";
import { sendReconnectEmail } from "@/lib/reconnect/email";
import {
  appendUnsubscribeFooter,
  defaultCampaignMessage,
  emailBodyToHtml,
} from "@/lib/reconnect/message";
import {
  eligibleEmailContacts,
  eligibleWhatsappContacts,
  getCampaign,
  listContacts,
  makeUnsubscribeToken,
  recordDelivery,
  saveCampaign,
} from "@/lib/reconnect/store";
import type {
  CampaignChannel,
  CampaignMessage,
  ReconnectCampaign,
} from "@/lib/reconnect/types";
import { sendWhatsappTemplate } from "@/lib/reconnect/whatsapp";

function nowIso() {
  return new Date().toISOString();
}

export async function createCampaign(input: {
  name: string;
  channel: CampaignChannel;
  message?: Partial<CampaignMessage>;
  mode?: "test" | "live";
}): Promise<ReconnectCampaign> {
  const contacts = await listContacts();
  const eligible =
    input.channel === "email"
      ? eligibleEmailContacts(contacts)
      : eligibleWhatsappContacts(contacts);

  const message = {
    ...defaultCampaignMessage(),
    ...input.message,
  };
  if (message.bodyText && !message.bodyHtml) {
    message.bodyHtml = emailBodyToHtml(message.bodyText);
  }

  const campaign: ReconnectCampaign = {
    id: randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    name: input.name,
    channel: input.channel,
    status: "draft",
    mode: input.mode || "test",
    message,
    recipientContactIds: eligible.map((c) => c.id),
    eligibleCount: eligible.length,
    sentCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    optedOutCount: 0,
    skippedCount: 0,
    repliedCount: 0,
    ownerApproved: false,
    approvedAt: null,
    lawfulBasisAcknowledged: false,
    costEstimate: estimateCampaignCost(input.channel, eligible.length),
    actualCost: null,
    actualCostNote:
      "Actual cost remains null until provider invoices / delivery webhooks confirm billable events.",
    batchSize: input.channel === "email" ? 20 : 10,
    delayMs: input.channel === "email" ? 1500 : 2000,
    idempotencyPrefix: `reconnect:${randomUUID().slice(0, 8)}`,
  };

  await saveCampaign(campaign);
  return campaign;
}

export async function updateCampaignMessage(
  id: string,
  message: Partial<CampaignMessage>
): Promise<ReconnectCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;
  if (campaign.status === "running" || campaign.status === "completed") {
    throw new Error("Cannot edit message while running or completed");
  }
  campaign.message = {
    ...campaign.message,
    ...message,
    bodyHtml:
      message.bodyHtml ||
      (message.bodyText
        ? emailBodyToHtml(message.bodyText)
        : campaign.message.bodyHtml),
  };
  campaign.updatedAt = nowIso();
  await saveCampaign(campaign);
  return campaign;
}

export async function requestApproval(
  id: string,
  opts: { lawfulBasisAcknowledged: boolean; mode: "test" | "live" }
): Promise<ReconnectCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;
  if (!opts.lawfulBasisAcknowledged) {
    throw new Error("Lawful basis / permission acknowledgment required");
  }
  campaign.lawfulBasisAcknowledged = true;
  campaign.mode = opts.mode;
  campaign.status = "awaiting_approval";
  campaign.updatedAt = nowIso();
  // Refresh cost estimate
  campaign.costEstimate = estimateCampaignCost(
    campaign.channel,
    campaign.eligibleCount
  );
  await saveCampaign(campaign);
  return campaign;
}

export async function approveCampaign(
  id: string,
  approvedBy = "owner"
): Promise<ReconnectCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;
  if (!campaign.lawfulBasisAcknowledged) {
    throw new Error("Acknowledge lawful basis before approval");
  }
  if (campaign.status !== "awaiting_approval" && campaign.status !== "test_sent") {
    throw new Error("Campaign must be awaiting approval (or tested) before approve");
  }
  campaign.ownerApproved = true;
  campaign.approvedAt = nowIso();
  campaign.approvedBy = approvedBy;
  campaign.status = "approved";
  campaign.updatedAt = nowIso();
  await saveCampaign(campaign);
  return campaign;
}

export async function pauseCampaign(id: string): Promise<ReconnectCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;
  if (campaign.status !== "running") return campaign;
  campaign.status = "paused";
  campaign.updatedAt = nowIso();
  await saveCampaign(campaign);
  return campaign;
}

export async function resumeCampaign(id: string): Promise<ReconnectCampaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;
  if (campaign.status !== "paused" && campaign.status !== "approved") {
    return campaign;
  }
  campaign.status = "running";
  campaign.updatedAt = nowIso();
  await saveCampaign(campaign);
  return campaign;
}

export async function sendTestEmail(
  campaignId: string,
  toEmail: string
): Promise<{ ok: boolean; error?: string; campaign?: ReconnectCampaign }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.channel !== "email") {
    return { ok: false, error: "Email campaign not found" };
  }

  const result = await sendReconnectEmail({
    to: toEmail,
    subject: `[TEST] ${campaign.message.subject}`,
    text: `[TEST MODE — not a customer send]\n\n${campaign.message.bodyText}`,
    html: campaign.message.bodyHtml,
  });

  if (!result.sent) return { ok: false, error: result.error };
  campaign.status = "test_sent";
  campaign.updatedAt = nowIso();
  await saveCampaign(campaign);
  return { ok: true, campaign };
}

/**
 * Process up to `limit` recipients. Idempotent per contact+campaign.
 * Never auto-starts without ownerApproved for live mode.
 */
export async function runCampaignBatch(
  campaignId: string,
  limit?: number
): Promise<ReconnectCampaign | null> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return null;

  if (campaign.mode === "live" && !campaign.ownerApproved) {
    throw new Error("Live campaign requires explicit owner approval");
  }
  if (
    campaign.status !== "approved" &&
    campaign.status !== "running" &&
    campaign.status !== "paused"
  ) {
    throw new Error(`Cannot run from status ${campaign.status}`);
  }

  campaign.status = "running";
  campaign.updatedAt = nowIso();
  await saveCampaign(campaign);

  const contacts = await listContacts();
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const max = limit ?? campaign.batchSize;
  let processed = 0;

  for (const contactId of campaign.recipientContactIds) {
    if (processed >= max) break;
    // Re-read pause state
    const live = await getCampaign(campaignId);
    if (!live || live.status === "paused" || live.status === "cancelled") {
      return live;
    }

    const contact = byId.get(contactId);
    if (!contact || contact.suppressed || contact.permissionStatus === "opted_out") {
      campaign.skippedCount += 1;
      processed += 1;
      continue;
    }

    // Duplicate-send prevention
    const already = contact.delivery.some(
      (d) =>
        d.campaignId === campaign.id &&
        (d.status === "sent" || d.status === "delivered" || d.status === "queued")
    );
    if (already) {
      campaign.skippedCount += 1;
      processed += 1;
      continue;
    }

    if (campaign.channel === "email" && contact.email) {
      const unsub = absoluteUrl(
        `/unsubscribe?c=${encodeURIComponent(contact.id)}&e=${encodeURIComponent(contact.email)}&t=${makeUnsubscribeToken(contact.id, contact.email)}`
      );
      const text = appendUnsubscribeFooter(campaign.message.bodyText, unsub);
      const result = await sendReconnectEmail({
        to: contact.email,
        subject: campaign.message.subject,
        text,
        html: campaign.message.bodyHtml,
      });
      if (result.sent) {
        campaign.sentCount += 1;
        await recordDelivery(contact.id, {
          campaignId: campaign.id,
          channel: "email",
          status: "sent",
          provider: result.provider || undefined,
          providerMessageId: result.messageId,
          providerConfirmed: false,
        });
        // Gmail/Resend acceptance ≠ Meta-style delivery receipt; do not increment deliveredCount
      } else {
        campaign.failedCount += 1;
        await recordDelivery(contact.id, {
          campaignId: campaign.id,
          channel: "email",
          status: "failed",
          provider: result.provider || undefined,
          providerMessageId: null,
          error: result.error,
          providerConfirmed: false,
        });
      }
    } else if (campaign.channel === "whatsapp" && contact.phoneE164) {
      const template =
        campaign.message.whatsappTemplateName ||
        process.env.WHATSAPP_RECONNECT_TEMPLATE_NAME ||
        "";
      const result = await sendWhatsappTemplate({
        toE164: contact.phoneE164,
        templateName: template,
        languageCode: campaign.message.whatsappTemplateLanguage || "en",
        bodyTextFallback: campaign.message.whatsappText,
      });
      if (result.accepted) {
        campaign.sentCount += 1;
        await recordDelivery(contact.id, {
          campaignId: campaign.id,
          channel: "whatsapp",
          status: "sent",
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          providerConfirmed: false,
        });
        // deliveredCount only via webhook
      } else {
        campaign.failedCount += 1;
        await recordDelivery(contact.id, {
          campaignId: campaign.id,
          channel: "whatsapp",
          status: "failed",
          provider: result.provider,
          providerMessageId: null,
          error: result.error,
          providerConfirmed: false,
        });
      }
    } else {
      campaign.skippedCount += 1;
    }

    processed += 1;
    campaign.updatedAt = nowIso();
    await saveCampaign(campaign);

    if (campaign.delayMs > 0) {
      await new Promise((r) => setTimeout(r, campaign.delayMs));
    }
  }

  const refreshedContacts = await listContacts();
  const doneIds = new Set(
    refreshedContacts
      .filter((c) =>
        c.delivery.some(
          (d) =>
            d.campaignId === campaign.id &&
            ["sent", "delivered", "failed", "skipped", "opted_out"].includes(
              d.status
            )
        )
      )
      .map((c) => c.id)
  );
  const stillPending = campaign.recipientContactIds.filter((id) => !doneIds.has(id));

  campaign.status = stillPending.length === 0 ? "completed" : "paused";
  campaign.updatedAt = nowIso();
  await saveCampaign(campaign);
  return campaign;
}
