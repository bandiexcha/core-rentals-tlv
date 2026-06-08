import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { InquiryPayload, StoredInquiry } from "@/lib/inquiry-types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "inquiries.json");

async function saveToUpstash(record: StoredInquiry): Promise<boolean> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) return false;

  const response = await fetch(
    `${baseUrl}/lpush/inquiries/${encodeURIComponent(JSON.stringify(record))}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  return response.ok;
}

async function readInquiries(): Promise<StoredInquiry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveInquiry(
  payload: InquiryPayload,
  emailSent: boolean
): Promise<StoredInquiry> {
  const record: StoredInquiry = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    emailSent,
    ...payload,
  };

  let stored = false;

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const inquiries = await readInquiries();
    inquiries.push(record);
    await fs.writeFile(DATA_FILE, JSON.stringify(inquiries, null, 2) + "\n");
    stored = true;
  } catch {
    // Read-only filesystem (e.g. Vercel serverless) — fall through to Upstash
  }

  if (!stored) {
    stored = await saveToUpstash(record);
  }

  if (!stored) {
    throw new Error("No inquiry storage available");
  }

  return record;
}
