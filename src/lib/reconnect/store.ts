import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import fs from "fs/promises";
import path from "path";
import type {
  DeliveryEvent,
  ImportBatch,
  ReconnectCampaign,
  ReconnectContact,
} from "@/lib/reconnect/types";
import type { ExtractedRow } from "@/lib/reconnect/extract";
import { getUpstashRestConfig, isUpstashConfigured } from "@/lib/upstash";

const DATA_DIR = path.join(process.cwd(), "data", "reconnect");
const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");
const IMPORTS_FILE = path.join(DATA_DIR, "imports.json");
const CAMPAIGNS_FILE = path.join(DATA_DIR, "campaigns.json");

const CONTACTS_INDEX = "reconnect:contact-ids";
const IMPORTS_INDEX = "reconnect:import-ids";
const CAMPAIGNS_INDEX = "reconnect:campaign-ids";
const contactKey = (id: string) => `reconnect:contact:${id}`;
const importKey = (id: string) => `reconnect:import:${id}`;
const campaignKey = (id: string) => `reconnect:campaign:${id}`;

function nowIso() {
  return new Date().toISOString();
}

async function upstashConfigured() {
  return isUpstashConfigured();
}

async function upstashFetch(command: (string | number)[]) {
  const cfg = getUpstashRestConfig();
  if (!cfg) return null;
  const response = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) return null;
  return (await response.json()) as { result?: unknown; error?: string };
}

async function readJsonFile<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonFile<T>(file: string, rows: T[]): Promise<boolean> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(rows, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

async function saveEntity(
  indexKey: string,
  key: string,
  id: string,
  value: unknown,
  file: string,
  listAll: () => Promise<unknown[]>
): Promise<void> {
  const all = await listAll();
  const arr = all as Array<{ id: string }>;
  const idx = arr.findIndex((x) => x.id === id);
  if (idx >= 0) arr[idx] = value as { id: string };
  else arr.push(value as { id: string });
  const fsOk = await writeJsonFile(file, arr);

  let redisOk = false;
  if (await upstashConfigured()) {
    const set = await upstashFetch(["SET", key, JSON.stringify(value)]);
    await upstashFetch(["LREM", indexKey, 0, id]);
    const push = await upstashFetch(["LPUSH", indexKey, id]);
    redisOk = Boolean(set && !set.error && push && !push.error);
  }

  if (!fsOk && !redisOk) {
    throw new Error("No durable storage available for reconnect data");
  }
}

async function listFromRedis<T>(
  indexKey: string,
  keyFn: (id: string) => string,
  limit = 5000
): Promise<T[]> {
  const idsRes = await upstashFetch(["LRANGE", indexKey, 0, limit - 1]);
  const ids = Array.isArray(idsRes?.result) ? (idsRes!.result as string[]) : [];
  const out: T[] = [];
  for (const id of ids) {
    const got = await upstashFetch(["GET", keyFn(id)]);
    if (typeof got?.result === "string") {
      try {
        out.push(JSON.parse(got.result) as T);
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

export async function listContacts(): Promise<ReconnectContact[]> {
  if (await upstashConfigured()) {
    const fromRedis = await listFromRedis<ReconnectContact>(
      CONTACTS_INDEX,
      contactKey
    );
    if (fromRedis.length) return fromRedis;
  }
  return readJsonFile<ReconnectContact>(CONTACTS_FILE);
}

export async function getContact(id: string): Promise<ReconnectContact | null> {
  if (await upstashConfigured()) {
    const got = await upstashFetch(["GET", contactKey(id)]);
    if (typeof got?.result === "string") {
      try {
        return JSON.parse(got.result) as ReconnectContact;
      } catch {
        /* fall through */
      }
    }
  }
  const all = await readJsonFile<ReconnectContact>(CONTACTS_FILE);
  return all.find((c) => c.id === id) ?? null;
}

export async function listImports(): Promise<ImportBatch[]> {
  if (await upstashConfigured()) {
    const fromRedis = await listFromRedis<ImportBatch>(IMPORTS_INDEX, importKey);
    if (fromRedis.length) return fromRedis;
  }
  return readJsonFile<ImportBatch>(IMPORTS_FILE);
}

export async function listCampaigns(): Promise<ReconnectCampaign[]> {
  if (await upstashConfigured()) {
    const fromRedis = await listFromRedis<ReconnectCampaign>(
      CAMPAIGNS_INDEX,
      campaignKey
    );
    if (fromRedis.length) return fromRedis;
  }
  return readJsonFile<ReconnectCampaign>(CAMPAIGNS_FILE);
}

export async function getCampaign(
  id: string
): Promise<ReconnectCampaign | null> {
  const all = await listCampaigns();
  return all.find((c) => c.id === id) ?? null;
}

export async function saveCampaign(campaign: ReconnectCampaign): Promise<void> {
  await saveEntity(
    CAMPAIGNS_INDEX,
    campaignKey(campaign.id),
    campaign.id,
    campaign,
    CAMPAIGNS_FILE,
    () => listCampaigns()
  );
}

export async function saveContact(contact: ReconnectContact): Promise<void> {
  await saveEntity(
    CONTACTS_INDEX,
    contactKey(contact.id),
    contact.id,
    contact,
    CONTACTS_FILE,
    () => listContacts()
  );
}

export async function importExtractedRows(input: {
  fileName: string;
  fileType: string;
  channelHint: "email" | "whatsapp" | "auto";
  rows: ExtractedRow[];
  rejectedInFile: number;
  notes: string[];
}): Promise<{ batch: ImportBatch; imported: number; duplicates: number }> {
  const existing = await listContacts();
  const byEmail = new Map(
    existing.filter((c) => c.email).map((c) => [c.email!, c])
  );
  const byPhone = new Map(
    existing.filter((c) => c.phoneE164).map((c) => [c.phoneE164!, c])
  );

  const batch: ImportBatch = {
    id: randomUUID(),
    createdAt: nowIso(),
    fileName: input.fileName,
    fileType: input.fileType,
    channelHint: input.channelHint,
    totalRaw: input.rows.length + input.rejectedInFile,
    imported: 0,
    duplicates: 0,
    rejected: input.rejectedInFile,
    notes: input.notes,
  };

  for (const row of input.rows) {
    if (row.channel === "email" && row.email) {
      const found = byEmail.get(row.email);
      if (found) {
        batch.duplicates += 1;
        found.sources.push({
          importId: batch.id,
          fileName: input.fileName,
          at: nowIso(),
        });
        if (!found.displayName && row.displayName) {
          found.displayName = row.displayName;
        }
        found.updatedAt = nowIso();
        await saveContact(found);
        continue;
      }
      const contact: ReconnectContact = {
        id: randomUUID(),
        email: row.email,
        displayName: row.displayName,
        channel: "email",
        permissionStatus: "legacy_customer",
        suppressed: false,
        sources: [
          { importId: batch.id, fileName: input.fileName, at: nowIso() },
        ],
        delivery: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      byEmail.set(row.email, contact);
      await saveContact(contact);
      batch.imported += 1;
    } else if (row.channel === "whatsapp" && row.phoneE164) {
      const found = byPhone.get(row.phoneE164);
      if (found) {
        batch.duplicates += 1;
        found.sources.push({
          importId: batch.id,
          fileName: input.fileName,
          at: nowIso(),
        });
        if (!found.displayName && row.displayName) {
          found.displayName = row.displayName;
        }
        if (!found.emailMentionUnverified && row.emailMentionUnverified) {
          found.emailMentionUnverified = row.emailMentionUnverified;
        }
        found.updatedAt = nowIso();
        await saveContact(found);
        continue;
      }
      const contact: ReconnectContact = {
        id: randomUUID(),
        phoneE164: row.phoneE164,
        displayName: row.displayName,
        channel: "whatsapp",
        permissionStatus: "legacy_customer",
        suppressed: false,
        emailMentionUnverified: row.emailMentionUnverified,
        sources: [
          { importId: batch.id, fileName: input.fileName, at: nowIso() },
        ],
        delivery: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      byPhone.set(row.phoneE164, contact);
      await saveContact(contact);
      batch.imported += 1;
    } else {
      batch.rejected += 1;
    }
  }

  await saveEntity(
    IMPORTS_INDEX,
    importKey(batch.id),
    batch.id,
    batch,
    IMPORTS_FILE,
    () => listImports()
  );

  return { batch, imported: batch.imported, duplicates: batch.duplicates };
}

export function eligibleEmailContacts(
  contacts: ReconnectContact[]
): ReconnectContact[] {
  return contacts.filter(
    (c) =>
      c.channel === "email" &&
      c.email &&
      !c.suppressed &&
      c.permissionStatus !== "opted_out"
  );
}

export function eligibleWhatsappContacts(
  contacts: ReconnectContact[]
): ReconnectContact[] {
  return contacts.filter(
    (c) =>
      c.channel === "whatsapp" &&
      c.phoneE164 &&
      !c.suppressed &&
      c.permissionStatus !== "opted_out"
  );
}

export async function suppressContact(
  id: string,
  reason: string,
  channel?: "email" | "whatsapp"
): Promise<ReconnectContact | null> {
  const contact = await getContact(id);
  if (!contact) return null;
  if (channel && contact.channel !== channel) return contact;
  contact.suppressed = true;
  contact.permissionStatus = "opted_out";
  contact.suppressReason = reason;
  contact.updatedAt = nowIso();
  await saveContact(contact);
  return contact;
}

export function unsubscribeSecret(): string {
  return (
    process.env.RECONNECT_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.CRM_ADMIN_PASSWORD?.trim() ||
    "dev-only-reconnect-secret"
  );
}

export function makeUnsubscribeToken(contactId: string, email: string): string {
  const payload = `${contactId}:${email.toLowerCase()}`;
  return createHmac("sha256", unsubscribeSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(
  contactId: string,
  email: string,
  token: string
): boolean {
  const expected = makeUnsubscribeToken(contactId, email);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export async function recordDelivery(
  contactId: string,
  event: Omit<DeliveryEvent, "id" | "at"> & { at?: string }
): Promise<void> {
  const contact = await getContact(contactId);
  if (!contact) return;
  const full: DeliveryEvent = {
    id: randomUUID(),
    at: event.at || nowIso(),
    campaignId: event.campaignId,
    channel: event.channel,
    status: event.status,
    provider: event.provider,
    providerMessageId: event.providerMessageId ?? null,
    error: event.error,
    providerConfirmed: event.providerConfirmed,
  };
  contact.delivery.push(full);
  contact.updatedAt = nowIso();
  if (event.channel === "email" && event.status === "sent") {
    contact.lastEmailedCampaignId = event.campaignId;
  }
  if (event.channel === "whatsapp" && event.status === "sent") {
    contact.lastWhatsappCampaignId = event.campaignId;
  }
  if (event.status === "opted_out") {
    contact.suppressed = true;
    contact.permissionStatus = "opted_out";
  }
  await saveContact(contact);
}
