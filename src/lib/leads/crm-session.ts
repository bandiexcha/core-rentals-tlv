import { cookies } from "next/headers";
import {
  CRM_SESSION_COOKIE,
  extractBearer,
  isCrmAuthConfigured,
  verifyCrmPassword,
} from "@/lib/leads/auth";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export async function requireCrmSession(
  request?: Request
): Promise<{ ok: true } | { ok: false; reason: string; status: number }> {
  if (!FEATURE_FLAGS.crmAdmin) {
    return { ok: false, reason: "CRM disabled", status: 503 };
  }
  if (!isCrmAuthConfigured()) {
    return {
      ok: false,
      reason: "CRM_ADMIN_PASSWORD not configured",
      status: 503,
    };
  }

  if (request) {
    const bearer = extractBearer(request);
    if (bearer && verifyCrmPassword(bearer)) return { ok: true };
  }

  const jar = await cookies();
  const session = jar.get(CRM_SESSION_COOKIE)?.value;
  if (verifyCrmPassword(session)) return { ok: true };

  return { ok: false, reason: "Unauthorized", status: 401 };
}
