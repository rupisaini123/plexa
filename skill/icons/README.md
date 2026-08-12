# Alexa skill icons

Upload these icons to the Alexa Developer Console when creating your skill:

| File | Size | Format |
|------|------|--------|
| `icon-108.png` | 108×108 | PNG (ready to upload) |
| `icon-512.png` | 512×512 | PNG (ready to upload) |

SVG sources (`icon-108.svg`, `icon-512.svg`) are included for editing. Re-export PNGs after changes (use `resvg-js` — ImageMagick strips SVG gradient colors):

```bash
npx @resvg/resvg-js-cli --fit-width 108 skill/icons/icon-108.svg skill/icons/icon-108.png
npx @resvg/resvg-js-cli --fit-width 512 skill/icons/icon-512.svg skill/icons/icon-512.png
```
