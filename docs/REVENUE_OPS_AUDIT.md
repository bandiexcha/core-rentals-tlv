# Core Rentals TLV — Production Revenue Ops Audit & Delivery

**Production:** https://core-rentals-tlv.vercel.app  
**Audit date:** 2026-10-26  
**Scope:** Phases 1–7 (audit, durable leads, CRM, campaigns, Orchestra boundary, metrics, acceptance)

---

## 1. Current production audit (evidence)

| Capability | Status | Evidence |
|---|---|---|
| Property inventory | **EXISTS AND VERIFIED** | `src/data/apartments.json`: 374 total, 374 published, 0 without images/name. Catalog filters + request-availability flow intact. |
| Demo / stale / incomplete listings | **EXISTS AND VERIFIED** (managed) | Unpublished filter in `getAllApartments()`; published set is complete for images/names. No fabricated campaign inventory. |
| Inquiry forms | **EXISTS AND VERIFIED** | `/contact` + `ContactForm` → `POST /api/inquiry`. Apartment prefill via `?apartment=`. |
| Inquiry persistence | **EXISTS BUT BROKEN** (prod without Upstash) → **FIXED in code** | Legacy: FS `data/inquiries.json` (fails on Vercel) + Upstash LPUSH write-only. Now also creates durable CRM leads (FS + Upstash GET/SET/LIST). **Prod still needs `UPSTASH_REDIS_REST_*` for durable recovery after redeploy.** |
| Request delivery | **EXISTS AND VERIFIED** | Resend → Gmail → Web3Forms to `SITE.inquiryEmail` (`avishayairbnb@gmail.com`). WhatsApp fallback URL if email fails. |
| Recoverable after reload | **MISSING** → **IMPLEMENTED (code)** | Lead records with UUID; CRM list/detail APIs. Requires Upstash + `CRM_ADMIN_PASSWORD` in production. |
| Unique inquiry/lead IDs | **EXISTS AND VERIFIED** | UUID on inquiry + lead (`randomUUID`). Returned as `leadId` in inquiry API response / thank-you reference. |
| Attribution / UTM | **MISSING** → **IMPLEMENTED** | First-touch cookie `cr_tlv_attr` via `AttributionCapture`; passed into inquiry + lead. |
| CRM / pipeline / quotes | **MISSING** → **IMPLEMENTED** | `/admin/crm` + APIs; statuses NEW→…→COMPLETED/LOST/CANCELLED; quotes versioned; CSV export. |
| Contact management / lifecycle | **MISSING** → **IMPLEMENTED** | Owner, notes, timeline, follow-up, kind (`lead` / `historical_contact` / `corporate_prospect` / `supplier`), opt-out. |
| Duplicate detection | **MISSING** → **IMPLEMENTED** | Same-email flag within 30 days (`duplicateOf`); no auto-merge. |
| Mobile inquiry completion | **EXISTS AND VERIFIED** | Responsive form + mobile WhatsApp button. Extra fields remain single-column on small screens. |
| Analytics / GTM | **MISSING** → **IMPLEMENTED (gated)** | `Analytics` loads only if `NEXT_PUBLIC_GA_MEASUREMENT_ID` or `NEXT_PUBLIC_GTM_ID` set. **Prod IDs not verified — BLOCKED on owner.** |
| Google Search Console / indexing | **EXISTS AND VERIFIED** (site-side) | `robots.ts`, `sitemap.ts` (now includes `/campaigns/*`), canonical metadata. **GSC property ownership not verified in repo — BLOCKED on owner.** |
| Conversion tracking | **MISSING** | No GA conversion events wired until measurement ID exists. |
| Orchestra OS / Cloud | **MISSING** → **BOUNDARY IMPLEMENTED** | Inbound `/api/orchestra/*` with `ORCHESTRA_API_KEY`. **No verified Orchestra Cloud outbound contract in repo — do not invent endpoints.** Live sync **BLOCKED** until key + Orchestra consumer config. |

---

## 2. Preserved (not rebuilt)

- Public catalog, apartment pages, guides, about, contact request-and-quote journey  
- No public rental prices  
- No instant-booking marketplace  
- Email SSOT: `avishayairbnb@gmail.com`  
- WhatsApp concierge path  

---

## 3. Changes made

### Phase 2 — Durable leads + attribution
- `src/lib/leads/*` — types, store, attribution, auth, metrics, orchestra view  
- Inquiry API creates CRM lead when `FEATURE_DURABLE_LEADS` (default on)  
- `AttributionCapture` + ContactForm sends UTM / landing / campaign  
- Consent checkbox; destination, bedrooms, requirements fields  

### Phase 3 — CRM pipeline
- `/admin/crm` operator dashboard (password-gated)  
- APIs: login, leads list/detail/patch, quotes, metrics, CSV  
- Quote versioning; lost/cancelled reasons; verified revenue only when operator enters  
- Record kinds separate historical contacts / prospects / suppliers  

### Phase 4 — Campaign destinations
- `/campaigns` + 9 indexable pages (corporate, relocation, film/TV, Israelis abroad, summer, Passover, delegations, sports, extended stay)  
- SEO titles/descriptions, FAQ JSON-LD, internal links, CTAs into `/contact` with campaign UTMs  
- Sitemap + footer links  

### Phase 5 — Orchestra boundary
- `GET/POST /api/orchestra/leads` (Orchestra-sourced only; no full DB dump)  
- `GET /api/orchestra/leads/[id]`  
- `POST /api/orchestra/leads/[id]/quote-request` → human task  
- `GET /api/orchestra/attribution` → campaign URLs with UTMs  
- Auth: `Authorization: Bearer <ORCHESTRA_API_KEY>`  

### Phase 6 — Metrics
- Truthful counts from real leads; revenue null until verified; CAC omitted without spend data  

### Phase 7 — Acceptance harness
- `scripts/test-crm-e2e.mjs`  

### Flags / env
- See `.env.example`: `CRM_ADMIN_PASSWORD`, `ORCHESTRA_API_KEY`, Upstash, feature flags, optional GA/GTM  

---

## 4. Production deployment

| Item | Value |
|---|---|
| Site | https://core-rentals-tlv.vercel.app |
| Commits | `7e9eea3` (CRM/campaigns/Orchestra), `b2b7021` (audit hash), `72b438f` (inquiry soft-fail) |
| Production deploy | `dpl_FYuwQJe5EYocC41wWwiauqXMt8Pn` → https://core-rentals-tlv.vercel.app |
| Inspect | https://vercel.com/bandiexchas-projects/core-rentals-tlv/FYuwQJe5EYocC41wWwiauqXMt8Pn |
| Admin | https://core-rentals-tlv.vercel.app/admin/crm |
| Campaign index | https://core-rentals-tlv.vercel.app/campaigns |
| Example LP | https://core-rentals-tlv.vercel.app/campaigns/corporate-accommodation-tel-aviv |

---

## 5. Test results (run locally / post-deploy)

```bash
# Local (dev server running)
node scripts/test-crm-e2e.mjs --base http://localhost:3000 --crm-password "$CRM_ADMIN_PASSWORD"

# Production (after env configured)
node scripts/test-crm-e2e.mjs --base https://core-rentals-tlv.vercel.app --crm-password "$CRM_ADMIN_PASSWORD" --orchestra-key "$ORCHESTRA_API_KEY"
```

### Local (with CRM password) — 2026-10-26
PASS 9 · FAIL 0 · SKIP 1 (Orchestra key unset). Lead ID issued; attribution recovered; quote + metrics OK.

### Production (https://core-rentals-tlv.vercel.app) — after `72b438f` deploy
PASS 4 · FAIL 0 · SKIP 2. Campaign/contact/sitemap/inquiry HTTP 200. `leadId=none` and `emailSent=false` until **Upstash** + email providers are set on Vercel; WhatsApp fallback preserved (no 500). CRM/Orchestra skipped without secrets.

**Do not** use real customer emails during testing.

---

## 6. Blockers (owner / credentials)

1. **`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`** on Vercel — without these, leads cannot survive serverless FS.  
2. **`CRM_ADMIN_PASSWORD`** — CRM remains **BLOCKED** in production until set.  
3. **`ORCHESTRA_API_KEY`** shared with Orchestra — API returns 503 until set; Orchestra must call *this* inbound API (no invented Orchestra Cloud URLs).  
4. **GA / GTM / GSC** — provide real IDs / verify Search Console property.  
5. **Ad spend feed** — required before CPL/CAC metrics can be non-null.  
6. **Email providers** — confirm at least one of Resend/Gmail/Web3Forms remains configured for owner notifications.  

---

## 7. LIVE / TEST / NOT IMPLEMENTED

| Surface | Status |
|---|---|
| Public inquiry form | **LIVE** (existing) |
| Durable CRM leads (code) | **TEST** until Upstash + password on prod |
| `/admin/crm` | **TEST** / **BLOCKED** without `CRM_ADMIN_PASSWORD` |
| Campaign pages | **LIVE** after deploy |
| Orchestra API | **NOT LIVE** until `ORCHESTRA_API_KEY` + Orchestra consumer |
| GA conversion tracking | **NOT IMPLEMENTED** (loader ready; IDs missing) |
| Invented revenue/stats | **NOT IMPLEMENTED** (by design) |
| Instant booking / public prices | **NOT IMPLEMENTED** (by design) |

---

## 8. Remaining work (commercial impact order)

1. **Configure Upstash + CRM password on Vercel and redeploy** — unlocks recoverable pipeline (highest impact).  
2. **Issue Orchestra API key and connect their acquisition engine to `/api/orchestra/*`.**  
3. **Add GA/GTM + GSC verification** — measure campaigns.  
4. **Operator SOP:** daily “action today”, quote discipline, verified revenue only on confirmed bookings.  
5. **Optional:** import historical contacts as `historical_contact` (never auto-mark completed).  
6. **Optional:** WhatsApp inbound → lead creation (not in this delivery).  
