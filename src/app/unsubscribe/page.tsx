import type { Metadata } from "next";
import {
  suppressContact,
  verifyUnsubscribeToken,
} from "@/lib/reconnect/store";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Unsubscribe",
  description: "Opt out of Core Rentals TLV reconnect emails.",
  path: "/unsubscribe",
  noIndex: true,
});

interface PageProps {
  searchParams: Promise<{ c?: string; e?: string; t?: string }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const contactId = params.c?.trim() || "";
  const email = params.e?.trim() || "";
  const token = params.t?.trim() || "";

  let message = "Invalid or incomplete unsubscribe link.";
  let ok = false;

  if (contactId && email && token && verifyUnsubscribeToken(contactId, email, token)) {
    const contact = await suppressContact(contactId, "email_unsubscribe_link", "email");
    if (contact) {
      ok = true;
      message = `You have been unsubscribed (${email}). You will not receive further Core Rentals TLV reconnect emails.`;
    } else {
      message = "Contact not found. If you still receive mail, reply UNSUBSCRIBE.";
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-serif text-3xl text-navy">
        {ok ? "Unsubscribed" : "Unsubscribe"}
      </h1>
      <p className="mt-4 text-sm text-muted">{message}</p>
    </div>
  );
}
