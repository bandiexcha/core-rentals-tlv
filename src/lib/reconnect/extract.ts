import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";
import {
  extractEmailsFromText,
  extractPhonesFromText,
  inferChannelHint,
  normalizeEmail,
  normalizePhoneE164,
} from "@/lib/reconnect/normalize";

export type ExtractedRow = {
  email?: string;
  phoneE164?: string;
  displayName?: string;
  emailMentionUnverified?: string;
  channel: "email" | "whatsapp";
  raw?: string;
};

export type ExtractResult = {
  rows: ExtractedRow[];
  rejected: Array<{ raw: string; reason: string }>;
  notes: string[];
  fileType: string;
  channelHint: "email" | "whatsapp" | "auto";
};

async function textFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text || "";
}

function textFromWorkbook(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    parts.push(XLSX.utils.sheet_to_csv(sheet));
  }
  return parts.join("\n");
}

/**
 * Parse "Name Email" style lines from Core Rentals email PDF exports.
 * Never invents names — only captures when a non-placeholder name precedes the email.
 */
function parseEmailNamedLines(text: string): ExtractedRow[] {
  const rows: ExtractedRow[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const emails = extractEmailsFromText(line);
    if (emails.length !== 1) continue;
    const email = emails[0];
    const before = line.replace(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").trim();
    let displayName: string | undefined;
    if (
      before &&
      !/^name(\s+email)?$/i.test(before) &&
      !/name not recorded/i.test(before) &&
      !/core rentals/i.test(before) &&
      before.length < 80
    ) {
      displayName = before.replace(/^\d+\s*/, "").trim() || undefined;
    }
    rows.push({ email, displayName, channel: "email", raw: line });
  }
  return rows;
}

/**
 * Parse WhatsApp consolidated PDF rows that include +E.164 phones.
 * Email-in-chat is stored as unverified mention only — never used as email campaign identity.
 */
function parseWhatsappLines(text: string): ExtractedRow[] {
  const rows: ExtractedRow[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const phones = extractPhonesFromText(line);
    if (phones.length === 0) continue;
    // Prefer the first E.164-looking phone on the line
    const phoneE164 = phones[0];
    const emails = extractEmailsFromText(line);
    const emailMentionUnverified = emails[0];
    // Attempt name: text before first +
    const plusIdx = line.indexOf("+");
    let displayName: string | undefined;
    if (plusIdx > 0) {
      const left = line
        .slice(0, plusIdx)
        .replace(/^\d+\s*/, "")
        .replace(/—/g, " ")
        .trim();
      if (
        left &&
        left.length < 80 &&
        !/^name/i.test(left) &&
        left !== "—" &&
        !/screenshot/i.test(left)
      ) {
        displayName = left;
      }
    }
    rows.push({
      phoneE164,
      displayName,
      emailMentionUnverified,
      channel: "whatsapp",
      raw: line,
    });
  }
  return rows;
}

export async function extractContactsFromFile(input: {
  buffer: Buffer;
  fileName: string;
  channelHint?: "email" | "whatsapp" | "auto";
}): Promise<ExtractResult> {
  const lower = input.fileName.toLowerCase();
  const channelHint = inferChannelHint(input.fileName, input.channelHint);
  const notes: string[] = [];
  const rejected: ExtractResult["rejected"] = [];
  let text = "";
  let fileType = "txt";

  if (lower.endsWith(".pdf")) {
    fileType = "pdf";
    text = await textFromPdf(input.buffer);
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    fileType = "xlsx";
    text = textFromWorkbook(input.buffer);
  } else if (lower.endsWith(".csv")) {
    fileType = "csv";
    text = input.buffer.toString("utf8");
  } else if (lower.endsWith(".txt")) {
    fileType = "txt";
    text = input.buffer.toString("utf8");
  } else {
    // Best-effort UTF-8
    fileType = "unknown";
    text = input.buffer.toString("utf8");
    notes.push("Unrecognized extension — treated as plain text.");
  }

  let rows: ExtractedRow[] = [];

  if (channelHint === "whatsapp") {
    rows = parseWhatsappLines(text);
    notes.push(
      "WhatsApp import: email-in-chat fields are stored as unverified mentions and are NOT used for email campaigns."
    );
  } else if (channelHint === "email") {
    rows = parseEmailNamedLines(text);
    if (rows.length === 0) {
      // Fallback: bare email list
      for (const email of extractEmailsFromText(text)) {
        rows.push({ email, channel: "email" });
      }
    }
  } else {
    // Auto: collect both, keep channels separate (no cross-matching)
    const emailRows = parseEmailNamedLines(text);
    const phoneRows = parseWhatsappLines(text);
    if (emailRows.length === 0) {
      for (const email of extractEmailsFromText(text)) {
        emailRows.push({ email, channel: "email" });
      }
    }
    rows = [...emailRows, ...phoneRows];
    notes.push(
      "Auto mode kept email and WhatsApp identities separate — no email↔phone merging."
    );
  }

  // Validate / dedupe within this file
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  const unique: ExtractedRow[] = [];

  for (const row of rows) {
    if (row.channel === "email") {
      const email = row.email ? normalizeEmail(row.email) : null;
      if (!email) {
        rejected.push({ raw: row.raw || "", reason: "invalid_email" });
        continue;
      }
      if (seenEmail.has(email)) {
        rejected.push({ raw: email, reason: "duplicate_in_file" });
        continue;
      }
      seenEmail.add(email);
      unique.push({ ...row, email });
    } else {
      const phone = row.phoneE164
        ? normalizePhoneE164(row.phoneE164)
        : null;
      if (!phone) {
        rejected.push({ raw: row.raw || "", reason: "invalid_phone" });
        continue;
      }
      if (seenPhone.has(phone)) {
        rejected.push({ raw: phone, reason: "duplicate_in_file" });
        continue;
      }
      seenPhone.add(phone);
      unique.push({ ...row, phoneE164: phone });
    }
  }

  notes.push(
    `Extracted ${unique.length} unique row(s); rejected ${rejected.length} within file.`
  );

  return { rows: unique, rejected, notes, fileType, channelHint };
}
