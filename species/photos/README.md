# Species photographs

One image per species, named by its `slug` in `../species.json`:

```
species/photos/black-faced-spoonbill.jpg
species/photos/northern-pintail.webp
```

Any extension works (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`) — the viewer
looks the file up by slug through a manifest, so nothing needs renaming to a
fixed format. Drop a file in and reload; the dev server re-reads this folder on
every request, so no restart is needed.

Landscape-ish crops read best: the card renders the image at 4:3 and
`object-fit: cover`, so a tall portrait will lose its top and bottom.

A species with no file here shows a coloured placeholder rather than a broken
image, which is also how you can tell at a glance which ones are still missing.

## Licensing

These are **not** ours to redistribute, for the same reason `calls/` is not —
see `NOTICE.md`. Record what you used in `CREDITS.json` beside the photo files
(photographer, source URL, licence) before this goes anywhere public. Prefer
CC-BY / CC0 sources, or the photographer's written permission.
