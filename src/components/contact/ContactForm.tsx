"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ATTRIBUTION_COOKIE } from "@/lib/leads/attribution";
import type { Attribution } from "@/lib/leads/types";

interface InquiryResponse {
  success?: boolean;
  emailSent?: boolean;
  whatsappUrl?: string;
  leadId?: string;
  error?: string;
}

function readAttributionCookie(): Attribution | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ATTRIBUTION_COOKIE}=`));
  if (!match) return undefined;
  try {
    return JSON.parse(
      decodeURIComponent(match.split("=").slice(1).join("="))
    ) as Attribution;
  } catch {
    return undefined;
  }
}

export function ContactForm() {
  const searchParams = useSearchParams();
  const prefillApartment = searchParams.get("apartment") ?? "";
  const prefillDestination = searchParams.get("destination") ?? "";
  const campaign = searchParams.get("campaign") ?? searchParams.get("utm_campaign") ?? "";

  const [submitted, setSubmitted] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [submittedViaWhatsApp, setSubmittedViaWhatsApp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const cookieAttr = readAttributionCookie() ?? {};
    const attribution: Attribution = {
      ...cookieAttr,
      inquiryPage:
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : cookieAttr.inquiryPage,
      campaignSlug: cookieAttr.campaignSlug || campaign || undefined,
      utmCampaign: cookieAttr.utmCampaign || campaign || undefined,
    };

    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      apartment: String(data.get("apartment") ?? ""),
      checkin: String(data.get("checkin") ?? ""),
      checkout: String(data.get("checkout") ?? ""),
      guests: String(data.get("guests") ?? ""),
      bedroomsRequested: String(data.get("bedroomsRequested") ?? ""),
      destination: String(data.get("destination") ?? ""),
      requirements: String(data.get("requirements") ?? ""),
      notes: String(data.get("notes") ?? ""),
      message: String(data.get("notes") ?? ""),
      consentMarketing: data.get("consentMarketing") === "on",
      attribution,
    };

    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as InquiryResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to send inquiry.");
      }

      if (result.leadId) setLeadId(result.leadId);

      if (result.whatsappUrl) {
        setSubmittedViaWhatsApp(true);
        window.location.href = result.whatsappUrl;
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedViaWhatsApp) {
    return (
      <div className="rounded-2xl bg-cream p-8 text-center ring-1 ring-sand-dark/40">
        <p className="font-serif text-xl text-navy">Opening WhatsApp…</p>
        <p className="mt-2 text-sm text-muted">
          Email delivery is unavailable right now. Your inquiry was saved and
          we&apos;re opening WhatsApp so you can send it directly to our team.
        </p>
        {leadId && (
          <p className="mt-3 text-xs text-muted">Reference: {leadId}</p>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-2xl bg-cream p-8 text-center ring-1 ring-sand-dark/40">
        <p className="font-serif text-xl text-navy">Thank you</p>
        <p className="mt-2 text-sm text-muted">
          Your inquiry has been received. Our concierge team will respond
          shortly.
        </p>
        {leadId && (
          <p className="mt-3 text-xs text-muted">Reference: {leadId}</p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-cream p-6 ring-1 ring-sand-dark/40 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="name" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone (optional)" name="phone" type="tel" />
        <Field
          label="Apartment of interest"
          name="apartment"
          defaultValue={prefillApartment}
          placeholder="Any, or name a specific apartment"
        />
        <Field
          label="Destination / area"
          name="destination"
          defaultValue={prefillDestination}
          placeholder="Tel Aviv, neighborhood, or flexible"
        />
        <Field label="Bedrooms requested" name="bedroomsRequested" placeholder="e.g. 2" />
        <Field label="Check-in date" name="checkin" type="date" />
        <Field label="Check-out date" name="checkout" type="date" />
        <div className="sm:col-span-2">
          <Field label="Number of guests" name="guests" type="number" min={1} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
            Requirements
          </label>
          <textarea
            name="requirements"
            rows={2}
            placeholder="Workspace, parking, near family, accessibility, etc."
            className="w-full rounded-xl border border-sand-dark bg-sand px-4 py-3 text-sm text-navy placeholder:text-muted/60 focus:border-mediterranean focus:outline-none focus:ring-1 focus:ring-mediterranean"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
            Additional notes
          </label>
          <textarea
            name="notes"
            rows={4}
            placeholder="Neighborhood preferences, special requests, corporate billing, etc."
            className="w-full rounded-xl border border-sand-dark bg-sand px-4 py-3 text-sm text-navy placeholder:text-muted/60 focus:border-mediterranean focus:outline-none focus:ring-1 focus:ring-mediterranean"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 text-sm text-muted">
            <input
              type="checkbox"
              name="consentMarketing"
              className="mt-1 rounded border-sand-dark"
            />
            <span>
              I agree to be contacted about this inquiry and occasional updates
              about Core Rentals TLV. You can opt out anytime.
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-mediterranean px-6 py-3.5 text-sm font-medium tracking-wide text-cream transition-colors hover:bg-mediterranean-light disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send Inquiry"}
      </button>
      <p className="mt-3 text-center text-xs text-muted">
        Inquiries are handled by our concierge team. No payment or booking is
        processed on this site.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  min?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        min={min}
        className="w-full rounded-xl border border-sand-dark bg-sand px-4 py-3 text-sm text-navy placeholder:text-muted/60 focus:border-mediterranean focus:outline-none focus:ring-1 focus:ring-mediterranean"
      />
    </div>
  );
}
