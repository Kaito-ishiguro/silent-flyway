# What the licence does and does not cover

The MIT licence in `LICENSE` covers the **code** in this repository: the
composition pipeline, the analysis, and the viewer.

It cannot cover two other things this project depends on.

## Field recordings

The bird calls the pipeline consumes are collected from third parties. They are
**not redistributed here** — `calls/` is gitignored — and each carries whatever
licence its own source gives it. A recording lifted from a video platform is
generally *not* yours to publish, even when the project using it is open.

If you are reusing this project, supply your own recordings and clear their
rights yourself. [Xeno-canto](https://xeno-canto.org) is the usual starting
point for bird calls under Creative Commons terms, and it states the licence
and the recordist for every file. Credit the recordist.

## Population figures

The population anchors in `species/species.json` come from published survey
literature and remain the property of the bodies that collected them —
principally the Hong Kong Bird Watching Society, AFCD, and the studies cited
alongside each anchor.

Every anchor carries a `basis`:

- `documented` — the figure appears in a cited survey or report
- `estimated` — an interpolation or placeholder used to span a gap

**Anchors marked `estimated` are not data.** They exist so the timeline has
something to draw between real figures, and the viewer renders those stretches
dashed and says so on screen. Do not cite them, and replace them with sourced
figures before presenting any of this as fact.
