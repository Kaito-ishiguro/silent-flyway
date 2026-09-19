# Sourcing notes

Running record of what has been checked, what failed checking, and what is
still open. Anchors in `species/species.json` are marked `documented` only
after the cited page has been opened and the figure read back off it.

---

## Verified (source opened, figure confirmed)

| Species | Figures | Source |
| --- | --- | --- |
| Yellow-breasted Bunting | 3,000 (1959), 610 (1994), 300 (2002), 120 (2014) | [avifauna 056700](https://avifauna.hkbws.org.hk/species/0460/056700) |
| Eurasian Coot | 450 (1971), 2,600 (1972), 3,245 (1992), 66 (2012+) | [avifauna 007800](https://avifauna.hkbws.org.hk/species/0060/007800) |
| Northern Pintail | 8,651 (1997), 8,086 (2000) | [avifauna 002300](https://avifauna.hkbws.org.hk/species/0020/002300) |
| Common Shelduck | 115, 4,011, 387, 2,972, 1,300, 18, 1, 1 | [avifauna 000800](https://avifauna.hkbws.org.hk/species/0010/000800) |
| Dalmatian Pelican | 85 (1960), last record 3 Jan 2010 | [avifauna 023800](https://avifauna.hkbws.org.hk/species/0170/023800) |
| Black-headed Ibis | 18 (1973), 25 (1974), last record 27 Nov 1999 | [avifauna 021600](https://avifauna.hkbws.org.hk/species/0160/021600) |
| Black-faced Spoonbill | 375 (2017), 350 (2018), 383 (2019), 341 (2026) | [2019 census](https://www.hkbws.org.hk/cms/en/hkbws/work/endangered-species/bfs-en/bfs-census2019en), [2026 census](https://cms.hkbws.org.hk/cms/en/hkbws/work/endangered-species/bfs-en/bfs-census-en-2026) |
| Black-capped Kingfisher | 2.4% → 0.2% occupancy; mean peak 8 → 1.6 | [avifauna 028100](https://avifauna.hkbws.org.hk/species/0200/028100) |
| White-throated Kingfisher | 7.3% → 3.0% breeding occupancy | [avifauna 028300](https://avifauna.hkbws.org.hk/species/0200/028300) |

## The historical archive is open — the big unlock

The full run of the **Hong Kong Bird Report, 1958–2014**, is free to download.
The current CMS page only lists 1993 onward, which is why both research passes
assumed the older years were unavailable. The legacy index has everything:

- Index: https://www.hkbws.org.hk/web/eng/bird_report_eng.htm
- Pattern: `https://www.hkbws.org.hk/web/chi/documents/bird_report/<YEAR>_birdreport_protected.pdf`
- 1970 and 1971 are one combined volume, so its token is `1970-71`

Confirmed reachable (HTTP 200): `1970-71` (22 MB), `1972` (15 MB), `1973`
(12 MB), `1974` (18 MB), `1979` (11 MB), `1991` (31 MB). "protected" refers to
PDF copy/print restrictions, not access control.

Each report carries a Systematic List giving that year's records and maximum
counts per species. **This is the route to the 1960–1996 gap that both research
passes called impossible.** Extraction is manual or OCR-assisted, one volume at
a time.

## Contested — do not cite until settled

**Black-faced Spoonbill, the Deep Bay peak.** Three figures are in circulation:

- **411**, from the 2026 census report's phrase "the peak of 411 recorded ten
  years ago". The number is verified; the year 2016 is inferred from "ten years
  ago".
- **371 in 2016**, from a Chinese-language research pass, given without a URL.
- **462 in 2010** as the all-time Deep Bay high, from an HKBWS statement, which
  would make 411 a later local peak rather than the record.

These are reconcilable — a census-day count and a season peak are different
quantities — but not on present evidence. The 2016 anchor is marked `estimated`
until the 2016 census report itself is read.

## Failed verification

- **"All Hong Kong Bird Reports 1958–2012 are online"** — as stated, wrong: the
  CMS page lists 1993–2018. The claim is nonetheless substantially true via the
  legacy index above, which is better than the claim.
- **Long Valley species totals** (130 in 2006 rising to 314 in 2018, then 256 in
  2023, then "over 190" in 2026) — internally inconsistent, and almost
  certainly mixes a cumulative all-time species list with per-year counts.
  Species richness is not abundance and is not used here.
- **Deep Bay winter waterbird totals** — the same winter, 2016/17, was given as
  both 56,354 and 57,225. Site totals rather than per-species figures, so not
  usable as anchors regardless.
- **Yellow-breasted Bunting "tripled over three years to about 50 at Long
  Valley" (reported 2024)** and a separate claim of "up to 62 on autumn
  passage" — both plausible and both unsourced. If either can be sourced it
  would be a valuable post-2014 anchor, since the verified series currently
  ends at 120 in 2014.
- **Common Shelduck last record 2013** — contradicted by the HKBWS account,
  which records a bird present 26 February to 18 March 2020. The widely cited
  1998–2017 study simply ends in 2017.
- **White-throated Kingfisher 21.9% → 5.4%** — the primary account gives
  7.3% → 3.0% for breeding and 9.4% → 5.7% for winter. The larger figures are
  not supported.
- **Black-faced Spoonbill 375 in 2024** — the census page puts 375 in 2017.
  Whether 2024 was also 375 is unconfirmed and not assumed.

## Couldn't check

- 1978 and 1983 Bird Report figures quoted in an earlier pass, at the time. The
  archive is now known to be reachable, so these can be settled.
- `keybiodiversityareas.org` factsheet figures — an aggregator, not primary.
  Anything resting only on it is excluded.
- A Chinese-language pass returned its findings **with no source URLs at all**,
  despite the sourcing requirement. Nothing from it entered the data on its own
  authority; its claims were treated as leads and checked independently.

## Open leads worth chasing

1. Extract per-species maximum counts from the 1958–1996 Bird Reports. This is
   the only route to the first four decades.
2. The Shenzhen half of Deep Bay — Shenzhen Bird Watching Society and Futian
   Nature Reserve counts. The spoonbill census reports "Hong Kong & Shenzhen"
   jointly, so HK-only anchors and joint anchors are different quantities and
   must not be merged into one series.
3. The 2016 Black-faced Spoonbill census report, to settle the contested peak.
