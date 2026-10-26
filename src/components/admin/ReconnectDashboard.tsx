"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReconnectCampaign, ReconnectStats } from "@/lib/reconnect/types";

type AuthState = "loading" | "blocked" | "login" | "ready";

export function ReconnectDashboard() {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReconnectStats | null>(null);
  const [campaigns, setCampaigns] = useState<ReconnectCampaign[]>([]);
  const [selected, setSelected] = useState<ReconnectCampaign | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [channelHint, setChannelHint] = useState<"auto" | "email" | "whatsapp">(
    "auto"
  );
  const [lawful, setLawful] = useState(false);

  const load = useCallback(async () => {
    const [statsRes, campRes] = await Promise.all([
      fetch("/api/admin/reconnect/stats"),
      fetch("/api/admin/reconnect/campaigns"),
    ]);
    if (statsRes.status === 503) {
      setAuth("blocked");
      const body = await statsRes.json().catch(() => ({}));
      setMessage(body.error || "CRM password not configured");
      return;
    }
    if (statsRes.status === 401) {
      setAuth("login");
      return;
    }
    const statsJson = (await statsRes.json()) as { stats: ReconnectStats };
    const campJson = (await campRes.json()) as { campaigns: ReconnectCampaign[] };
    setStats(statsJson.stats);
    setCampaigns(campJson.campaigns || []);
    setAuth("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/admin/crm/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.status === 503) {
      setAuth("blocked");
      return;
    }
    if (!res.ok) {
      setLoginError("Invalid password");
      return;
    }
    setPassword("");
    await load();
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setMessage(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("channelHint", channelHint);
    const res = await fetch("/api/admin/reconnect/import", {
      method: "POST",
      body: data,
    });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) {
      setMessage(json.error || "Import failed");
      return;
    }
    setMessage(
      `Imported ${json.batch.imported} · duplicates ${json.batch.duplicates} · rejected ${json.batch.rejected}. No messages sent.`
    );
    form.reset();
    await load();
  }

  async function createCampaign(channel: "email" | "whatsapp") {
    const res = await fetch("/api/admin/reconnect/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, mode: "test" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "Create failed");
      return;
    }
    setSelected(json.campaign);
    setMessage(
      `Draft ${channel} campaign created with ${json.campaign.eligibleCount} eligible recipients. Review cost before approval.`
    );
    await load();
  }

  async function saveMessage() {
    if (!selected) return;
    const res = await fetch(`/api/admin/reconnect/campaigns/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: selected.message.subject,
        bodyText: selected.message.bodyText,
        whatsappText: selected.message.whatsappText,
        whatsappTemplateName: selected.message.whatsappTemplateName,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "Save failed");
      return;
    }
    setSelected(json.campaign);
    setMessage("Message saved");
  }

  async function action(
    act: string,
    extra: Record<string, unknown> = {}
  ) {
    if (!selected) return;
    const res = await fetch(
      `/api/admin/reconnect/campaigns/${selected.id}/actions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, ...extra }),
      }
    );
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "Action failed");
      return;
    }
    if (json.campaign) setSelected(json.campaign);
    setMessage(json.note || `${act} ok`);
    await load();
  }

  if (auth === "loading") {
    return <Shell>Loading…</Shell>;
  }
  if (auth === "blocked") {
    return (
      <Shell>
        <h1 className="font-serif text-2xl text-navy">Reconnect blocked</h1>
        <p className="mt-3 text-sm text-muted">
          {message || "Set CRM_ADMIN_PASSWORD to unlock owner tools."}
        </p>
      </Shell>
    );
  }
  if (auth === "login") {
    return (
      <Shell>
        <h1 className="font-serif text-2xl text-navy">Owner login</h1>
        <form onSubmit={handleLogin} className="mt-6 max-w-sm space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="CRM admin password"
            className="w-full rounded-xl border border-sand-dark bg-sand px-4 py-3 text-sm"
          />
          {loginError && <p className="text-sm text-red-700">{loginError}</p>}
          <button
            type="submit"
            className="rounded-full bg-mediterranean px-6 py-3 text-sm text-cream"
          >
            Sign in
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold">Owner</p>
          <h1 className="mt-1 font-serif text-3xl text-navy">
            Customer reconnect
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Upload historical contacts, review recipients, approve campaigns.
            Nothing sends automatically after import.
          </p>
        </div>
        <a href="/admin/crm" className="text-sm text-mediterranean hover:underline">
          CRM pipeline →
        </a>
      </div>

      {stats && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Unique emails" value={stats.uniqueEmails} />
          <Stat label="Unique WhatsApp" value={stats.uniquePhones} />
          <Stat label="Email eligible" value={stats.emailEligible} />
          <Stat label="WhatsApp eligible" value={stats.whatsappEligible} />
          <Stat label="Imported (all batches)" value={stats.importedTotal} />
          <Stat label="Duplicates skipped" value={stats.duplicateTotal} />
          <Stat label="Rejected" value={stats.rejectedTotal} />
          <Stat label="Email suppressed" value={stats.emailSuppressed} />
        </div>
      )}

      {stats && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <StatusCard
            title="Email sending"
            status={stats.emailIntegration.status}
            lines={[
              `Sender: ${stats.emailIntegration.senderIdentity}`,
              ...stats.emailIntegration.blockers,
            ]}
          />
          <StatusCard
            title="WhatsApp Cloud API"
            status={stats.whatsappIntegration.status}
            lines={[
              stats.whatsappIntegration.coexistenceNote,
              ...stats.whatsappIntegration.blockers,
            ]}
          />
        </div>
      )}

      {message && (
        <p className="mt-6 rounded-xl bg-cream px-4 py-3 text-sm text-navy ring-1 ring-sand-dark/40">
          {message}
        </p>
      )}

      <section className="mt-10 rounded-2xl bg-cream p-6 ring-1 ring-sand-dark/40">
        <h2 className="font-serif text-xl text-navy">1. Import contacts</h2>
        <p className="mt-2 text-sm text-muted">
          PDF, CSV, XLSX, or TXT. Email and phone identities stay separate —
          chat-mentioned emails are never treated as verified email contacts.
        </p>
        <form onSubmit={handleUpload} className="mt-4 flex flex-wrap items-end gap-3">
          <input
            type="file"
            name="file"
            accept=".pdf,.csv,.xlsx,.xls,.txt"
            required
            className="text-sm"
          />
          <select
            value={channelHint}
            onChange={(e) =>
              setChannelHint(e.target.value as "auto" | "email" | "whatsapp")
            }
            className="rounded-xl border border-sand-dark bg-sand px-3 py-2 text-sm"
          >
            <option value="auto">Auto-detect</option>
            <option value="email">Email list</option>
            <option value="whatsapp">WhatsApp phones</option>
          </select>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-full bg-navy px-5 py-2 text-sm text-cream disabled:opacity-50"
          >
            {uploading ? "Importing…" : "Upload & import"}
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-2xl bg-cream p-6 ring-1 ring-sand-dark/40">
        <h2 className="font-serif text-xl text-navy">2. Campaigns</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-mediterranean px-4 py-2 text-sm text-cream"
            onClick={() => void createCampaign("email")}
          >
            New email campaign
          </button>
          <button
            type="button"
            className="rounded-full border border-sand-dark px-4 py-2 text-sm"
            onClick={() => void createCampaign("whatsapp")}
          >
            New WhatsApp campaign
          </button>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {campaigns.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="text-left hover:text-mediterranean"
                onClick={() => setSelected(c)}
              >
                {c.name} · {c.channel} · {c.status} · {c.mode} · eligible{" "}
                {c.eligibleCount} · sent {c.sentCount}
              </button>
            </li>
          ))}
          {campaigns.length === 0 && (
            <li className="text-muted">No campaigns yet.</li>
          )}
        </ul>

        {selected && (
          <div className="mt-6 space-y-4 border-t border-sand-dark/40 pt-6">
            <h3 className="font-serif text-lg text-navy">{selected.name}</h3>
            <p className="text-xs text-muted">
              Status: {selected.status} · Mode: {selected.mode} · Approved:{" "}
              {selected.ownerApproved ? "yes" : "no"}
            </p>
            <p className="text-sm text-muted">
              Cost estimate:{" "}
              {selected.costEstimate.estimatedTotal == null
                ? "—"
                : `${selected.costEstimate.estimatedTotal} ${selected.costEstimate.currency}`}{" "}
              ({selected.costEstimate.recipientCount} recipients).{" "}
              {selected.costEstimate.note}
            </p>
            <p className="text-sm text-muted">
              Actual cost:{" "}
              {selected.actualCost == null
                ? "null (no provider-confirmed billable events yet)"
                : selected.actualCost}{" "}
              — {selected.actualCostNote}
            </p>

            {selected.channel === "email" ? (
              <>
                <label className="block text-xs uppercase text-muted">
                  Subject
                </label>
                <input
                  className="w-full rounded-xl border border-sand-dark bg-sand px-3 py-2 text-sm"
                  value={selected.message.subject}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      message: { ...selected.message, subject: e.target.value },
                    })
                  }
                />
                <label className="block text-xs uppercase text-muted">
                  Email body
                </label>
                <textarea
                  rows={12}
                  className="w-full rounded-xl border border-sand-dark bg-sand px-3 py-2 text-sm"
                  value={selected.message.bodyText}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      message: {
                        ...selected.message,
                        bodyText: e.target.value,
                      },
                    })
                  }
                />
              </>
            ) : (
              <>
                <label className="block text-xs uppercase text-muted">
                  WhatsApp text (preview / reference)
                </label>
                <textarea
                  rows={10}
                  className="w-full rounded-xl border border-sand-dark bg-sand px-3 py-2 text-sm"
                  value={selected.message.whatsappText}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      message: {
                        ...selected.message,
                        whatsappText: e.target.value,
                      },
                    })
                  }
                />
                <label className="block text-xs uppercase text-muted">
                  Approved Meta template name
                </label>
                <input
                  className="w-full rounded-xl border border-sand-dark bg-sand px-3 py-2 text-sm"
                  value={selected.message.whatsappTemplateName || ""}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      message: {
                        ...selected.message,
                        whatsappTemplateName: e.target.value,
                      },
                    })
                  }
                  placeholder="Required for live WhatsApp sends"
                />
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-sand-dark px-3 py-2 text-sm"
                onClick={() => void saveMessage()}
              >
                Save message
              </button>
              {selected.channel === "email" && (
                <button
                  type="button"
                  className="rounded-full border border-sand-dark px-3 py-2 text-sm"
                  onClick={() => void action("test")}
                >
                  Send test to owner inbox
                </button>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={lawful}
                onChange={(e) => setLawful(e.target.checked)}
                className="mt-1"
              />
              <span>
                I confirm these are former Core Rentals TLV / HolyGuest /
                SeaN&apos;Rent customers, I have an appropriate lawful basis /
                permission to contact them for reactivation, and suppression /
                opt-out will be honored.
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-sand-dark px-3 py-2 text-sm"
                onClick={() =>
                  void action("request_approval", {
                    lawfulBasisAcknowledged: lawful,
                    mode: "test",
                  })
                }
              >
                Request approval (test mode)
              </button>
              <button
                type="button"
                className="rounded-full border border-sand-dark px-3 py-2 text-sm"
                onClick={() =>
                  void action("request_approval", {
                    lawfulBasisAcknowledged: lawful,
                    mode: "live",
                  })
                }
              >
                Request approval (live mode)
              </button>
              <button
                type="button"
                className="rounded-full bg-navy px-3 py-2 text-sm text-cream"
                onClick={() => void action("approve")}
              >
                Owner approve
              </button>
              <button
                type="button"
                className="rounded-full bg-mediterranean px-3 py-2 text-sm text-cream"
                onClick={() => void action("run", { limit: selected.batchSize })}
              >
                Run next batch
              </button>
              <button
                type="button"
                className="rounded-full border border-sand-dark px-3 py-2 text-sm"
                onClick={() => void action("pause")}
              >
                Pause
              </button>
              <button
                type="button"
                className="rounded-full border border-sand-dark px-3 py-2 text-sm"
                onClick={() => void action("resume")}
              >
                Resume
              </button>
            </div>

            <p className="text-xs text-muted">
              Counts — sent: {selected.sentCount} · delivered (provider-confirmed
              only): {selected.deliveredCount} · failed: {selected.failedCount} ·
              skipped: {selected.skippedCount} · opted out:{" "}
              {selected.optedOutCount}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">{children}</div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-cream px-4 py-3 ring-1 ring-sand-dark/40">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl text-navy">{value}</p>
    </div>
  );
}

function StatusCard({
  title,
  status,
  lines,
}: {
  title: string;
  status: string;
  lines: string[];
}) {
  return (
    <div className="rounded-xl bg-cream p-4 ring-1 ring-sand-dark/40">
      <p className="text-xs uppercase tracking-wider text-muted">{title}</p>
      <p className="mt-1 font-medium text-navy">{status}</p>
      <ul className="mt-2 space-y-1 text-xs text-muted">
        {lines.filter(Boolean).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
