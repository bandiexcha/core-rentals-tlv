import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function getCrmAdminPassword(): string | null {
  return process.env.CRM_ADMIN_PASSWORD?.trim() || null;
}

export function getOrchestraApiKey(): string | null {
  return process.env.ORCHESTRA_API_KEY?.trim() || null;
}

export function isCrmAuthConfigured(): boolean {
  return Boolean(getCrmAdminPassword());
}

export function isOrchestraAuthConfigured(): boolean {
  return Boolean(getOrchestraApiKey());
}

/** Cookie / Bearer token for operator CRM. */
export function verifyCrmPassword(password: string | null | undefined): boolean {
  const expected = getCrmAdminPassword();
  if (!expected || !password) return false;
  return safeEqual(password, expected);
}

export function verifyOrchestraApiKey(key: string | null | undefined): boolean {
  const expected = getOrchestraApiKey();
  if (!expected || !key) return false;
  return safeEqual(key, expected);
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serviceUnavailable(message: string): NextResponse {
  return NextResponse.json({ error: message, status: "BLOCKED" }, { status: 503 });
}

export const CRM_SESSION_COOKIE = "cr_tlv_crm_session";

export function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}
