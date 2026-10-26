# Customer Reconnect System — PASS / BLOCKED Report

**Date:** 2026-10-26  
**Owner dashboard:** `/admin/reconnect` (same `CRM_ADMIN_PASSWORD` as CRM)  
**Private sources:** `data/customer-imports/*.pdf` (gitignored + `.vercelignore` `/data`)

---

## Initial import counts (owner review — no messages sent)

| Metric | Count |
|---|---|
| Unique emails | **83** |
| Unique WhatsApp phones (E.164) | **138** |
| Total contact records | **221** |
| Email ↔ phone auto-merge | **None** (by design) |

Sources used locally:
- `core_rentals_emails_found.pdf`
- `HolyGuest_SeaNRent_Customer_Emails_2014-2026_Expanded.pdf`
- `core_rentals_whatsapp_contacts_consolidated.pdf`

WhatsApp PDF “email in chat” fields were **not** imported as email identities (source disclaimer: may refer to someone else).

Re-run locally: `npm run reconnect:import`

---

## Audit of existing infrastructure

| Piece | Status |
|---|---|
| Auth | Reuses `CRM_ADMIN_PASSWORD` / CRM session cookie |
| Durable store | Same pattern as CRM: local `data/reconnect/*` + Upstash when configured |
| Email | Reuses Gmail SMTP / Resend (`sendReconnectEmail`) — inquiry path unchanged |
| WhatsApp on site | `wa.me/972527599399` click-to-chat only — **no** prior Cloud API |
| Marketing platforms | Not used (no Brevo/Mailchimp) |

---

## PASS / BLOCKED checklist

| # | Requirement | Result |
|---|---|---|
| 1 | File import + deduplication (PDF/CSV/XLSX/TXT) | **PASS** (code + seeded PDF import) |
| 2 | Durable contact storage | **PASS** locally · **BLOCKED on Vercel** until Upstash (+ re-upload or migrate JSON) |
| 3 | Email test delivery | **BLOCKED** until `GMAIL_APP_PASSWORD` and/or verified Resend from-address configured in the runtime env; UI supports “Send test to owner inbox” |
| 4 | WhatsApp integration readiness | **BLOCKED** — Cloud API client implemented; requires Meta WABA, token, phone number ID, approved marketing template, webhook, and owner confirmation of **coexistence** for +972 52-759-9399 (`WHATSAPP_COEXISTENCE_CONFIRMED=1`). **No authorized live WhatsApp test has succeeded.** |
| 5 | Owner dashboard | **PASS** (`/admin/reconnect`) |
| 6 | Live campaign readiness | **BLOCKED** — email live needs provider env + owner approval flow; WhatsApp live needs #4 |
| 7 | Remaining external approvals / costs | See below |

---

## WhatsApp coexistence (official)

Meta supports connecting an existing **WhatsApp Business app** number to Cloud API (“coexistence”) so the owner can keep using +972 52-759-9399 in the app while sending approved templates via API.  
This project **does not** migrate, disconnect, or alter the number. Owner must complete Meta Embedded Signup and only then set `WHATSAPP_COEXISTENCE_CONFIRMED=1`.

Estimated marketing template cost (Israel rate card, approx.): **~$0.0353 USD per delivered message** × eligible recipients. Shown in the dashboard before approval. Actual Meta invoice may vary by destination country.

---

## Safety controls implemented

- Owner-only admin  
- No send on import  
- Explicit lawful-basis checkbox + approve + run batch  
- Test mode vs live mode  
- Rate-limited batches + per-contact idempotency  
- Suppression / unsubscribe (`/unsubscribe`)  
- Delivered counts only when provider confirms (WhatsApp webhook)  
- Contact PDFs and `data/reconnect` excluded from git and Vercel deploy archive  

---

## How the owner operates (no Cursor needed)

1. Set `CRM_ADMIN_PASSWORD` (+ Upstash on Vercel).  
2. Open `/admin/reconnect`, sign in.  
3. Upload email PDF/CSV and WhatsApp PDF/CSV (or use seeded local data).  
4. Review unique counts on the dashboard.  
5. Create email campaign → edit message → **test send** → acknowledge lawful basis → approve → run batches.  
6. WhatsApp campaign stays blocked in UI/API until Cloud API env + coexistence confirmed + authorized test.

---

## Commits / deploy

Ship with the application code; **never** commit `data/customer-imports` or `data/reconnect/contacts.json`.
