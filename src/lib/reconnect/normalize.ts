const EMAIL_RE =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;

/** Extract candidate emails from free text. */
export function extractEmailsFromText(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  return [...new Set(matches.map((e) => normalizeEmail(e)).filter(Boolean) as string[])];
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  // Reject obvious non-customer placeholders
  if (
    /^(noreply|no-reply|mailer-daemon|postmaster)@/i.test(email) ||
    email.endsWith(".png") ||
    email.endsWith(".jpg")
  ) {
    return null;
  }
  return email;
}

/**
 * Normalize to E.164 when possible.
 * Defaults ambiguous local Israeli numbers (0X…) to +972.
 */
export function normalizePhoneE164(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;

  // Keep leading +; strip other punctuation/spaces
  const hasPlus = s.startsWith("+");
  s = s.replace(/[^\d+]/g, "");
  if (hasPlus && !s.startsWith("+")) s = `+${s.replace(/\D/g, "")}`;

  let digits = s.replace(/\D/g, "");
  if (!digits) return null;

  // Israeli local: 05xxxxxxxx → 9725xxxxxxxx
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) {
    digits = `972${digits.slice(1)}`;
  }

  // Already country-coded without +
  if (!s.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    // assume digits already include country code
  }

  if (digits.length < 10 || digits.length > 15) return null;

  // Basic sanity: not all same digit
  if (/^(\d)\1+$/.test(digits)) return null;

  return `+${digits}`;
}

export function extractPhonesFromText(text: string): string[] {
  const candidates = text.match(/\+?\d[\d\s\-().]{7,}\d/g) ?? [];
  const out = new Set<string>();
  for (const c of candidates) {
    const n = normalizePhoneE164(c);
    if (n) out.add(n);
  }
  return [...out];
}

/** Detect if a filename / hint implies channel. */
export function inferChannelHint(
  fileName: string,
  explicit?: string
): "email" | "whatsapp" | "auto" {
  if (explicit === "email" || explicit === "whatsapp") return explicit;
  const lower = fileName.toLowerCase();
  if (lower.includes("whatsapp") || lower.includes("phone") || lower.includes("wa_")) {
    return "whatsapp";
  }
  if (lower.includes("email") || lower.includes("mail")) return "email";
  return "auto";
}
