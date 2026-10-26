import { getEmailSenderStatus } from "@/lib/reconnect/email";
import {
  eligibleEmailContacts,
  eligibleWhatsappContacts,
  listCampaigns,
  listContacts,
  listImports,
} from "@/lib/reconnect/store";
import type { ReconnectStats } from "@/lib/reconnect/types";
import { getWhatsappIntegrationStatus } from "@/lib/reconnect/whatsapp";

export async function getReconnectStats(): Promise<ReconnectStats> {
  const [contacts, imports, campaigns] = await Promise.all([
    listContacts(),
    listImports(),
    listCampaigns(),
  ]);

  const emails = contacts.filter((c) => c.channel === "email" && c.email);
  const phones = contacts.filter((c) => c.channel === "whatsapp" && c.phoneE164);
  const emailEligible = eligibleEmailContacts(contacts);
  const waEligible = eligibleWhatsappContacts(contacts);
  const wa = getWhatsappIntegrationStatus();
  const email = getEmailSenderStatus();

  return {
    generatedAt: new Date().toISOString(),
    uniqueEmails: emails.length,
    uniquePhones: phones.length,
    emailEligible: emailEligible.length,
    whatsappEligible: waEligible.length,
    emailSuppressed: emails.filter((c) => c.suppressed).length,
    whatsappSuppressed: phones.filter((c) => c.suppressed).length,
    importBatches: imports.length,
    importedTotal: imports.reduce((s, b) => s + b.imported, 0),
    rejectedTotal: imports.reduce((s, b) => s + b.rejected, 0),
    duplicateTotal: imports.reduce((s, b) => s + b.duplicates, 0),
    campaigns: campaigns
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        channel: c.channel,
        status: c.status,
        mode: c.mode,
        sentCount: c.sentCount,
        deliveredCount: c.deliveredCount,
        failedCount: c.failedCount,
        optedOutCount: c.optedOutCount,
      })),
    whatsappIntegration: {
      status: wa.status,
      coexistenceNote: wa.coexistenceNote,
      blockers: wa.blockers,
    },
    emailIntegration: {
      status: email.status,
      blockers: email.blockers,
      senderIdentity: email.senderIdentity,
    },
  };
}
