# Yapel website

Static landing page for this fork. GitHub Pages publishes it from `.github/workflows/website.yml` when `website/` changes on `master`.

The site URL is `https://joshazmy.github.io/cider-ytm/`. `vite.config.ts` sets `base` to `/cider-ytm/` so that path resolves.

```bash
pnpm install
pnpm dev
pnpm build
```
