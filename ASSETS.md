# Core Rentals TLV — production assets

## Rule

GitHub holds **code and catalog JSON**.  
GitHub LFS is **not** our production media CDN.

| Asset | Location |
| --- | --- |
| Apartment gallery photos | **Vercel Blob** store `core-rentals-media-cdn` (`store_oczbMEwo4o86dEnX`) |
| Public URL prefix | `NEXT_PUBLIC_MEDIA_BASE_URL=https://oczbmewo4o86denx.public.blob.vercel-storage.com` |
| Catalog metadata | `src/data/apartments.json` (`/apartments/<slug>/01.jpg`) |

Runtime resolution: `src/lib/media.ts` → `resolveMediaUrl()`.

## Why this exists

August 2026: `bandiexcha` GitHub LFS bandwidth hit **10 GB / 10 GB** because:

1. `.gitattributes` tracked `public/apartments/**` (~5 471 files ≈ **9.8 GB**).
2. GitHub Actions used `actions/checkout` with `lfs: true` on every deploy.
3. Failed deploys still completed LFS checkout (~10 GB billed per run).

## Deploy rules

- CI: `lfs: false` + `GIT_LFS_SKIP_SMUDGE=1`.
- Never re-enable push-triggered deploys that pull LFS.
- Ordinary production deploys must not download LFS media.

## Upload

```bash
vercel blob create-store core-rentals-media --access public --yes   # once
vercel env pull .env.local
npm run media:upload
```

Set `NEXT_PUBLIC_MEDIA_BASE_URL` on Vercel (Production + Preview) so  
`${BASE}/apartments/<slug>/01.jpg` resolves on Blob.

## Guardrails

- `npm run check:assets` — fails on oversized staged/tracked media.
- Do not `git lfs track` new production media.
- Do not rewrite git history until Blob serves production and a backup exists.

## History cleanup (later)

Old LFS objects remain in git history (storage quota). Bandwidth is fixed by stopping checkouts. History rewrite is a separate, destructive step — not done yet.
