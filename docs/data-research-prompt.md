# Gemini Deep Research prompt — Hong Kong bird abundance, 1960–2026

Paste everything in the block below into Gemini Deep Research. It is
self-contained and public-safe.

When the results come back, they get verified against their cited primary
sources before any figure enters `species/species.json` — findings are split
into **verified / inference / couldn't check**, and only verified figures are
marked `basis: "documented"`.

---

```
I am building a data-driven sound and data visualisation about the decline of
bird populations in Hong Kong between 1960 and 2026. Each bird species is
represented by its own voice, and the frequency and loudness of that voice is
driven directly by that species' recorded abundance in each year. I therefore
need real, year-by-year abundance figures, with their sources, and an honest
account of where such figures do not exist.

SPECIES OF INTEREST (Hong Kong / Deep Bay / Mai Po / Long Valley)

Locally extirpated:
1. Black-headed Ibis (Threskiornis melanocephalus)
2. Dalmatian Pelican (Pelecanus crispus)
3. Common Shelduck (Tadorna tadorna)

Declining waterbirds:
4. Baer's Pochard (Aythya baeri)
5. Northern Pintail (Anas acuta)
6. Eurasian Wigeon (Mareca penelope)
7. Eurasian Teal (Anas crecca)
8. Eurasian Coot (Fulica atra)
9. Spoon-billed Sandpiper (Calidris pygmaea)
10. Black-faced Spoonbill (Platalea minor)

Farmland and terrestrial species:
11. Yellow-breasted Bunting (Emberiza aureola)
12. Black-capped Kingfisher (Halcyon pileata)
13. White-throated Kingfisher (Halcyon smyrnensis)

WHAT I NEED, PER SPECIES

A. A year-by-year series of abundance in Hong Kong, as long as the record
   allows, ideally 1960-2026. For each individual figure, state:
   - the year (or season, e.g. winter 1998/99)
   - the number
   - WHICH METRIC the number is. This matters more than the number itself.
     Label each figure as exactly one of:
       * peak winter count (highest single count in a wintering season)
       * mean winter count
       * annual passage count / peak passage count
       * breeding pairs
       * atlas occupancy (percentage or number of 1km squares occupied)
       * index or modelled trend (not a raw count)
     Do not silently mix metrics within one series, and do not convert
     between them.
   - the survey or programme that produced it
   - the source, per the sourcing requirement at the end

B. The date of the LAST confirmed record in Hong Kong, for any species now
   locally extinct, with the source for that specific date.

C. Explicit gaps. State plainly which years have no published figure, and do
   not interpolate, estimate, or fill them. A clearly marked gap is more
   useful to me than a smooth series. If a species has no usable Hong Kong
   series at all (for example because it is a passerine not covered by
   waterbird counts), say so directly and say what does exist instead.

D. Whether the species' Hong Kong trend matches or diverges from its global
   or flyway trend, with sources for both.

WHERE THE DATA LIVES

For each of the following, tell me what it actually contains, which years and
which species it covers, whether it is publicly downloadable, and the exact
URL to reach it:

- Hong Kong Bird Watching Society (HKBWS): the annual "Hong Kong Bird Report"
  (published since 1958), and any waterbird monitoring datasets. Which years
  are available, in what form (print, PDF, spreadsheet), how a member of the
  public requests data, and any cost.
- The Deep Bay / Mai Po waterbird monitoring programme run for the Agriculture,
  Fisheries and Conservation Department (AFCD). Which years are systematic,
  what changed methodologically in 1998, and where the summaries are published.
- AFCD public datasets, the Hong Kong Biodiversity Database, and data.gov.hk —
  any machine-readable bird abundance data.
- The Asian Waterbird Census (Wetlands International), Hong Kong results.
- The International Black-faced Spoonbill Census, per-site annual counts.
- The China Coastal Waterbird Census.
- The Hong Kong Breeding Bird Atlas and Winter Bird Atlas — survey periods,
  and what unit their results are reported in.
- Any peer-reviewed paper analysing multi-decadal Hong Kong waterbird trends,
  including any study of roughly 1998-2017 Deep Bay wintering trends. For each
  paper, state whether the underlying annual data is available as supplementary
  material, and link it directly.
- eBird and GBIF: how much Hong Kong coverage exists per decade, how to obtain
  a bulk download, and what the known effort and observer biases are. Be
  explicit that these give an effort-biased index rather than a census.

Also state, for each source, whether its figures may be reused and republished
in a public open-source art project, and what attribution it requires.

AUDIO AVAILABILITY

Separately, for each of the 13 species above, check Xeno-canto
(xeno-canto.org) and tell me how many recordings exist, which Creative Commons
licence they carry, and whether any were recorded in Hong Kong or southern
China. I need recordings I am permitted to reuse with attribution. Give direct
links to the best-quality candidates.

FORMAT

Return one section per species, each with a table of year / figure / metric /
source. Then a separate section covering the data sources themselves, and a
final section listing which of the 13 species have BOTH a usable multi-year
abundance series AND a reusable audio recording — that intersection is what I
can actually build with, so state it plainly and rank it.

Do not smooth, model, or estimate any figure. I would rather have eleven real
numbers across sixty years than a complete invented curve.

For every factual claim, statistic, name, date, or status, include: (1) the
exact source URL, (2) the source's publication date, and (3) the specific line
or figure that supports the claim. Prefer primary/official sources
(government, company, regulator, filings) over aggregators. Label any inference
or multi-source synthesis as "inference, not directly sourced." Never present
an unsourced or inferred claim as established fact.
```
