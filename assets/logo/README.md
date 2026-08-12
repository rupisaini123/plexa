# Plexa Logo

**Selected concept: 01 — Monogram Play**

Geometric white "P" with play-triangle counter on a purple gradient rounded square (`#6d5efc` → `#8577ff`).

## Production assets

| File | Use |
|------|-----|
| [`plexa-icon.svg`](plexa-icon.svg) | Canonical SVG source (transparent outside rounded square) |
| [`../web/public/logo-icon.svg`](../web/public/logo-icon.svg) | Web navbar + favicon |
| [`../web/public/favicon-32.png`](../web/public/favicon-32.png) | Browser tab fallback |
| [`../web/public/apple-touch-icon.png`](../web/public/apple-touch-icon.png) | iOS home screen |
| [`../../skill/icons/icon-108.png`](../../skill/icons/icon-108.png) | Alexa skill (small) |
| [`../../skill/icons/icon-512.png`](../../skill/icons/icon-512.png) | Alexa skill (large) |

## Concept explorations

Earlier logo directions are kept for reference under [`concepts/`](concepts/) (02–05 were not selected).

### 01 — Monogram Play (selected)

| Icon | Wordmark | Combo |
|------|----------|-------|
| `concepts/01-monogram/icon-512.png` | `concepts/01-monogram/wordmark.png` | `concepts/01-monogram/combo.png` |

## Re-exporting PNGs

From the repo root:

```bash
npx @resvg/resvg-js-cli --fit-width 32 assets/logo/plexa-icon.svg web/public/favicon-32.png
npx @resvg/resvg-js-cli --fit-width 180 assets/logo/plexa-icon.svg web/public/apple-touch-icon.png
npx @resvg/resvg-js-cli --fit-width 108 skill/icons/icon-108.svg skill/icons/icon-108.png
npx @resvg/resvg-js-cli --fit-width 512 skill/icons/icon-512.svg skill/icons/icon-512.png
```

Use `resvg-js` rather than ImageMagick — ImageMagick rasterizes these SVG gradients as grayscale.
