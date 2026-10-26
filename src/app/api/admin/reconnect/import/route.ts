import { NextResponse } from "next/server";
import { requireCrmSession } from "@/lib/leads/crm-session";
import { extractContactsFromFile } from "@/lib/reconnect/extract";
import { importExtractedRows } from "@/lib/reconnect/store";
import { getReconnectStats } from "@/lib/reconnect/stats";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "multipart/form-data required" },
      { status: 400 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const channelHint = String(form.get("channelHint") || "auto") as
    | "email"
    | "whatsapp"
    | "auto";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractContactsFromFile({
    buffer,
    fileName: file.name,
    channelHint,
  });

  const result = await importExtractedRows({
    fileName: file.name,
    fileType: extracted.fileType,
    channelHint: extracted.channelHint,
    rows: extracted.rows,
    rejectedInFile: extracted.rejected.length,
    notes: extracted.notes,
  });

  const stats = await getReconnectStats();

  return NextResponse.json({
    success: true,
    batch: result.batch,
    stats,
    preview: {
      sampleEmails: extracted.rows
        .filter((r) => r.email)
        .slice(0, 5)
        .map((r) => r.email),
      samplePhones: extracted.rows
        .filter((r) => r.phoneE164)
        .slice(0, 5)
        .map((r) => r.phoneE164),
    },
    note: "Import complete. No campaign messages were sent.",
  });
}
