import { NextResponse } from "next/server";
import {
  CRM_SESSION_COOKIE,
  isCrmAuthConfigured,
  serviceUnavailable,
  unauthorized,
  verifyCrmPassword,
} from "@/lib/leads/auth";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export async function POST(request: Request) {
  if (!FEATURE_FLAGS.crmAdmin) {
    return serviceUnavailable("CRM admin is disabled by feature flag.");
  }
  if (!isCrmAuthConfigured()) {
    return serviceUnavailable(
      "CRM_ADMIN_PASSWORD is not configured. Set it in the production environment."
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!verifyCrmPassword(body.password)) {
    return unauthorized("Invalid password");
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(CRM_SESSION_COOKIE, body.password!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(CRM_SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
