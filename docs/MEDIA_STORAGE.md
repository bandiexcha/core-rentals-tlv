# Media storage policy (core-rentals-tlv)

## Rule
GitHub stores **code**. Production apartment photos must NOT use Git LFS as a CDN.

## Canonical media location
- **Vercel Blob store:** `core-rentals-media-cdn` (`store_oczbMEwo4o86dEnX`)
- **Public host:** `oczbmewo4o86denx.public.blob.vercel-storage.com`
- **Path convention:** `apartments/<slug>/<file>` (same as former `public/apartments/...`)
- **Mapping file:** `docs/media-url-mapping.json` (old path → Blob URL)

## Do not
- Commit `public/apartments/**` binaries
- Enable `lfs: true` in GitHub Actions or rely on Git LFS during Vercel builds
- Set `GIT_LFS_SKIP_SMUDGE` unset in CI (always skip LFS smudge for deploys)

## Environment
- `NEXT_PUBLIC_MEDIA_BASE_URL` is set on Vercel **Production** and **Development**.
- **Preview** may be unset when the Vercel project is not linked to GitHub; `src/lib/media.ts` falls back to the public Blob host above.
- GitHub Actions variable `NEXT_PUBLIC_MEDIA_BASE_URL` is set for the deploy guard.

## Migration / verify
```bash
node scripts/migrate-apartments-to-blob.mjs
node scripts/verify-blob-media.mjs --head
```
