"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  RECORD_KINDS,
  type Lead,
  type LeadMetrics,
  type LeadStatus,
} from "@/lib/leads/types";

type AuthState = "loading" | "blocked" | "login" | "ready";

export function CrmDashboard() {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    const [leadsRes, metricsRes] = await Promise.all([
      fetch(`/api/admin/crm/leads?${params}`),
      fetch("/api/admin/crm/metrics"),
    ]);

    if (leadsRes.status === 503 || metricsRes.status === 503) {
      setAuth("blocked");
      const body = await leadsRes.json().catch(() => ({}));
      setMessage(body.error || "CRM not configured");
      return;
    }
    if (leadsRes.status === 401) {
      setAuth("login");
      return;
    }

    const leadsJson = (await leadsRes.json()) as { leads: Lead[] };
    const metricsJson = (await metricsRes.json()) as { metrics: LeadMetrics };
    setLeads(leadsJson.leads || []);
    setMetrics(metricsJson.metrics || null);
    setAuth("ready");
  }, [q, statusFilter]);

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
      const body = await res.json();
      setMessage(body.error);
      return;
    }
    if (!res.ok) {
      setLoginError("Invalid password");
      return;
    }
    setPassword("");
    await load();
  }

  async function handleLogout() {
    await fetch("/api/admin/crm/login", { method: "DELETE" });
    setAuth("login");
    setLeads([]);
    setSelected(null);
  }

  async function patchLead(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/crm/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMessage("Update failed");
      return;
    }
    const json = (await res.json()) as { lead: Lead };
    setSelected(json.lead);
    await load();
  }

  async function addQuote(id: string, send: boolean) {
    const amountRaw = window.prompt(
      "Verified quote amount (leave blank if not yet priced):"
    );
    const amount =
      amountRaw && amountRaw.trim() !== "" ? Number(amountRaw) : null;
    if (amountRaw && amountRaw.trim() !== "" && Number.isNaN(amount)) {
      setMessage("Invalid amount");
      return;
    }
    const notes = window.prompt("Quote notes (optional):") || undefined;
    const res = await fetch(`/api/admin/crm/leads/${id}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        currency: "ILS",
        notes,
        send,
        propertyIds: selected?.propertyIds ?? [],
        propertyNames: selected?.apartment ? [selected.apartment] : [],
      }),
    });
    if (!res.ok) {
      setMessage("Quote save failed");
      return;
    }
    const json = (await res.json()) as { lead: Lead };
    setSelected(json.lead);
    await load();
  }

  if (auth === "loading") {
    return <Shell>Loading CRM…</Shell>;
  }

  if (auth === "blocked") {
    return (
      <Shell>
        <h1 className="font-serif text-2xl text-navy">CRM blocked</h1>
        <p className="mt-3 text-sm text-muted">
          {message ||
            "Set CRM_ADMIN_PASSWORD in the environment to enable the operator dashboard."}
        </p>
        <p className="mt-2 text-xs text-muted">
          Status: <strong>BLOCKED</strong> — credentials required.
        </p>
      </Shell>
    );
  }

  if (auth === "login") {
    return (
      <Shell>
        <h1 className="font-serif text-2xl text-navy">Operator login</h1>
        <form onSubmit={handleLogin} className="mt-6 max-w-sm space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="CRM admin password"
            className="w-full rounded-xl border border-sand-dark bg-sand px-4 py-3 text-sm"
            autoComplete="current-password"
          />
          {loginError && (
            <p className="text-sm text-red-700">{loginError}</p>
          )}
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
          <p className="text-xs uppercase tracking-[0.25em] text-gold">
            Internal
          </p>
          <h1 className="mt-1 font-serif text-3xl text-navy">
            Lead pipeline
          </h1>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/admin/crm/leads?format=csv"
            className="rounded-full border border-sand-dark px-4 py-2 text-sm"
          >
            Export CSV
          </a>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-full border border-sand-dark px-4 py-2 text-sm"
          >
            Log out
          </button>
        </div>
      </div>

      {metrics && <MetricsPanel metrics={metrics} />}

      <div className="mt-8 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, campaign…"
          className="min-w-[220px] flex-1 rounded-xl border border-sand-dark bg-sand px-4 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-sand-dark bg-sand px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-navy px-4 py-2 text-sm text-cream"
        >
          Refresh
        </button>
      </div>

      {message && (
        <p className="mt-4 text-sm text-mediterranean">{message}</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="overflow-x-auto lg:col-span-2">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-sand-dark text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-2">Lead</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="cursor-pointer border-b border-sand-dark/50 hover:bg-cream"
                  onClick={() => setSelected(lead)}
                >
                  <td className="py-3 pr-2">
                    <div className="font-medium text-navy">{lead.name}</div>
                    <div className="text-xs text-muted">{lead.email}</div>
                    {lead.duplicateOf && (
                      <div className="text-xs text-amber-700">Possible dup</div>
                    )}
                  </td>
                  <td className="py-3 pr-2 text-xs">
                    {LEAD_STATUS_LABELS[lead.status]}
                  </td>
                  <td className="py-3 text-xs">{lead.source}</td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted">
                    No leads yet. Submit a test inquiry to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl bg-cream p-5 ring-1 ring-sand-dark/40 lg:col-span-3">
          {!selected ? (
            <p className="text-sm text-muted">Select a lead to manage.</p>
          ) : (
            <LeadDetail
              lead={selected}
              onPatch={(body) => void patchLead(selected.id, body)}
              onQuote={(send) => void addQuote(selected.id, send)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">{children}</div>
  );
}

function MetricsPanel({ metrics }: { metrics: LeadMetrics }) {
  const cards = [
    { label: "Total leads", value: metrics.totalLeads },
    { label: "New", value: metrics.newLeads },
    { label: "Qualified+", value: metrics.qualified },
    { label: "Quotes sent", value: metrics.quotesSent },
    { label: "Confirmed", value: metrics.confirmed },
    { label: "Action today", value: metrics.actionToday },
    {
      label: "Realized revenue",
      value:
        metrics.realizedRevenue == null
          ? "—"
          : String(metrics.realizedRevenue),
    },
  ];

  return (
    <div className="mt-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl bg-cream px-4 py-3 ring-1 ring-sand-dark/40"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted">
              {c.label}
            </p>
            <p className="mt-1 font-serif text-2xl text-navy">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{metrics.note}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
        {Object.entries(metrics.bySource).map(([k, v]) => (
          <span key={k} className="rounded-full bg-sand px-2 py-1">
            {k}: {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function LeadDetail({
  lead,
  onPatch,
  onQuote,
}: {
  lead: Lead;
  onPatch: (body: Record<string, unknown>) => void;
  onQuote: (send: boolean) => void;
}) {
  const [owner, setOwner] = useState(lead.owner || "");
  const [followUp, setFollowUp] = useState(
    lead.nextFollowUpAt?.slice(0, 16) || ""
  );
  const [note, setNote] = useState("");
  const [lostReason, setLostReason] = useState(lead.lostReason || "");

  useEffect(() => {
    setOwner(lead.owner || "");
    setFollowUp(lead.nextFollowUpAt?.slice(0, 16) || "");
    setLostReason(lead.lostReason || "");
  }, [lead]);

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="font-serif text-2xl text-navy">{lead.name}</h2>
        <p className="text-muted">
          {lead.email}
          {lead.phone ? ` · ${lead.phone}` : ""}
        </p>
        <p className="mt-1 text-xs text-muted">ID: {lead.id}</p>
        {lead.duplicateOf && (
          <p className="mt-1 text-xs text-amber-700">
            Flagged possible duplicate of {lead.duplicateOf} (not auto-merged)
          </p>
        )}
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        <Item label="Apartment" value={lead.apartment || "—"} />
        <Item label="Destination" value={lead.destination || "—"} />
        <Item label="Dates" value={`${lead.checkin || "?"} → ${lead.checkout || "?"}`} />
        <Item label="Guests / beds" value={`${lead.guests || "—"} / ${lead.bedroomsRequested || "—"}`} />
        <Item label="Campaign" value={lead.attribution.utmCampaign || lead.attribution.campaignSlug || "—"} />
        <Item label="Landing" value={lead.attribution.landingPage || "—"} />
        <Item
          label="Verified revenue"
          value={
            lead.verifiedRevenue == null
              ? "Not set"
              : `${lead.verifiedRevenue} ${lead.verifiedRevenueCurrency || ""}`
          }
        />
        <Item label="Opted out" value={lead.optedOut ? "yes" : "no"} />
      </dl>

      <p className="whitespace-pre-wrap rounded-xl bg-sand p-3 text-muted">
        {lead.message || lead.notes || "No message"}
      </p>

      <div className="flex flex-wrap gap-2">
        <select
          value={lead.status}
          onChange={(e) =>
            onPatch({ status: e.target.value as LeadStatus })
          }
          className="rounded-xl border border-sand-dark bg-sand px-3 py-2"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={lead.kind}
          onChange={(e) => onPatch({ kind: e.target.value })}
          className="rounded-xl border border-sand-dark bg-sand px-3 py-2"
        >
          {RECORD_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          value={lead.source}
          disabled
          className="rounded-xl border border-sand-dark bg-sand px-3 py-2 opacity-70"
        >
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Owner"
          className="rounded-xl border border-sand-dark bg-sand px-3 py-2"
        />
        <button
          type="button"
          className="rounded-full bg-navy px-3 py-2 text-cream"
          onClick={() => onPatch({ owner })}
        >
          Set owner
        </button>
        <input
          type="datetime-local"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          className="rounded-xl border border-sand-dark bg-sand px-3 py-2"
        />
        <button
          type="button"
          className="rounded-full border border-sand-dark px-3 py-2"
          onClick={() =>
            onPatch({
              nextFollowUpAt: followUp
                ? new Date(followUp).toISOString()
                : null,
            })
          }
        >
          Set follow-up
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-mediterranean px-3 py-2 text-cream"
          onClick={() => onQuote(false)}
        >
          Prepare quote
        </button>
        <button
          type="button"
          className="rounded-full border border-mediterranean px-3 py-2 text-mediterranean"
          onClick={() => onQuote(true)}
        >
          Prepare & mark sent
        </button>
        <button
          type="button"
          className="rounded-full border border-sand-dark px-3 py-2"
          onClick={() => {
            const amount = window.prompt("Verified booking revenue (number):");
            if (amount == null) return;
            const n = Number(amount);
            if (Number.isNaN(n)) return;
            onPatch({
              verifiedRevenue: n,
              verifiedRevenueCurrency: "ILS",
              status: "confirmed",
            });
          }}
        >
          Confirm + revenue
        </button>
        <button
          type="button"
          className="rounded-full border border-sand-dark px-3 py-2"
          onClick={() => onPatch({ optedOut: !lead.optedOut })}
        >
          {lead.optedOut ? "Clear opt-out" : "Mark opt-out"}
        </button>
      </div>

      {(lead.status === "lost" || lead.status === "cancelled") && (
        <div className="flex gap-2">
          <input
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Lost / cancelled reason"
            className="flex-1 rounded-xl border border-sand-dark bg-sand px-3 py-2"
          />
          <button
            type="button"
            className="rounded-full border border-sand-dark px-3 py-2"
            onClick={() =>
              onPatch(
                lead.status === "cancelled"
                  ? { cancelledReason: lostReason }
                  : { lostReason }
              )
            }
          >
            Save reason
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add timeline note"
          className="flex-1 rounded-xl border border-sand-dark bg-sand px-3 py-2"
        />
        <button
          type="button"
          className="rounded-full border border-sand-dark px-3 py-2"
          onClick={() => {
            if (!note.trim()) return;
            onPatch({ notes: note.trim() });
            setNote("");
          }}
        >
          Add note
        </button>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wider text-muted">Quotes</h3>
        <ul className="mt-2 space-y-2">
          {lead.quotes.length === 0 && (
            <li className="text-muted">No quotes yet</li>
          )}
          {lead.quotes.map((q) => (
            <li key={q.id} className="rounded-lg bg-sand px-3 py-2 text-xs">
              v{q.version} · {q.status}
              {q.amount != null ? ` · ${q.amount} ${q.currency || ""}` : " · amount pending"}
              {q.notes ? ` — ${q.notes}` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wider text-muted">Timeline</h3>
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {[...lead.timeline].reverse().map((t) => (
            <li key={t.id} className="border-l-2 border-gold/40 pl-3 text-xs">
              <span className="text-muted">
                {new Date(t.at).toLocaleString()} · {t.type}
                {t.actor ? ` · ${t.actor}` : ""}
              </span>
              <div>{t.message}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-navy">{value}</dd>
    </div>
  );
}
