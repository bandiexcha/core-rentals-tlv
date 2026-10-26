/**
 * One-shot local import of private PDFs under data/customer-imports/.
 * Does NOT send any messages. Does NOT commit contact data.
 *
 * Usage: node scripts/import-customer-reconnect.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const ROOT = process.cwd();
const IMPORT_DIR = path.join(ROOT, "data", "customer-imports");
const OUT_DIR = path.join(ROOT, "data", "reconnect");

const EMAIL_RE =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;

function normalizeEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (/^(noreply|no-reply|mailer-daemon|postmaster)@/i.test(email)) return null;
  return email;
}

function normalizePhone(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;
  const hasPlus = s.startsWith("+");
  s = s.replace(/[^\d+]/g, "");
  let digits = s.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) {
    digits = `972${digits.slice(1)}`;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  return `+${digits}`;
}

async function pdfText(filePath) {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  const result = await parser.getText();
  return result.text || "";
}

function extractEmails(text) {
  const set = new Set();
  for (const m of text.match(EMAIL_RE) || []) {
    const n = normalizeEmail(m);
    if (n) set.add(n);
  }
  return [...set].sort();
}

function extractPhones(text) {
  const set = new Set();
  for (const m of text.match(/\+?\d[\d\s\-().]{7,}\d/g) || []) {
    const n = normalizePhone(m);
    if (n) set.add(n);
  }
  return [...set].sort();
}

async function main() {
  if (!fs.existsSync(IMPORT_DIR)) {
    console.error("Missing", IMPORT_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(IMPORT_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  console.log("PDF sources:", files.join(", "));

  const emailFiles = files.filter((f) => /email/i.test(f) && !/whatsapp/i.test(f));
  const waFiles = files.filter((f) => /whatsapp/i.test(f));

  const emails = new Set();
  const phones = new Set();
  const rejected = [];

  for (const f of emailFiles) {
    const text = await pdfText(path.join(IMPORT_DIR, f));
    for (const e of extractEmails(text)) emails.add(e);
    console.log(`  ${f}: emails in file → running unique total ${emails.size}`);
  }

  for (const f of waFiles) {
    const text = await pdfText(path.join(IMPORT_DIR, f));
    // Do NOT import email-in-chat as email contacts (PDF disclaimer).
    for (const p of extractPhones(text)) phones.add(p);
    console.log(`  ${f}: phones in file → running unique total ${phones.size}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const now = new Date().toISOString();
  const contacts = [];

  for (const email of [...emails].sort()) {
    contacts.push({
      id: crypto.randomUUID(),
      email,
      channel: "email",
      permissionStatus: "legacy_customer",
      suppressed: false,
      sources: [{ importId: "seed-pdf", fileName: "email-pdfs", at: now }],
      delivery: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const phone of [...phones].sort()) {
    contacts.push({
      id: crypto.randomUUID(),
      phoneE164: phone,
      channel: "whatsapp",
      permissionStatus: "legacy_customer",
      suppressed: false,
      sources: [{ importId: "seed-pdf", fileName: "whatsapp-pdfs", at: now }],
      delivery: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  const batch = {
    id: crypto.randomUUID(),
    createdAt: now,
    fileName: files.join("; "),
    fileType: "pdf",
    channelHint: "auto",
    totalRaw: emails.size + phones.size,
    imported: contacts.length,
    duplicates: 0,
    rejected: rejected.length,
    notes: [
      "Seeded from local data/customer-imports PDFs.",
      "Email↔phone not merged.",
      "WhatsApp chat-mentioned emails ignored for email channel.",
      "No campaigns sent.",
    ],
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "contacts.json"),
    JSON.stringify(contacts, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "imports.json"),
    JSON.stringify([batch], null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "campaigns.json"),
    JSON.stringify([], null, 2) + "\n"
  );

  const summary = {
    uniqueEmails: emails.size,
    uniqueWhatsAppPhones: phones.size,
    totalContactRecords: contacts.length,
    emailEligible: emails.size,
    whatsappEligible: phones.size,
    sources: { emailFiles, waFiles },
    storage: path.join(OUT_DIR, "contacts.json"),
    note: "PASS — counts ready for owner review. No messages sent.",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "import-summary.json"),
    JSON.stringify(summary, null, 2) + "\n"
  );

  console.log("\n=== OWNER REVIEW — UNIQUE COUNTS (no send) ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
