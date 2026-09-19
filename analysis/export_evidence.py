"""
Silent Flyway - provenance workbook export.

Usage:
    .venv\\Scripts\\python analysis/export_evidence.py

Builds the Excel proof file from species/species.json and
docs/evidence-log.json, so the workbook can never drift out of step with the
data the piece is actually built from. Regenerate it after any data change;
never hand-edit it.

    data/evidence/Silent_Flyway_Data_Provenance.xlsx

Sheets:
    Read me           what the basis codes mean and how to use this
    Anchors           every figure in the piece, with source and basis
    Annual series     the anchors interpolated to one row per year, which is
                      what the sculpture actually plays
    Verified          the sentence read back off each live source
    Rejected          claims that failed checking, and why
    Species           per-species summary and audio status
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
SPECIES = ROOT / "species" / "species.json"
EVIDENCE = ROOT / "docs" / "evidence-log.json"
# docs/, not data/: data/ is gitignored as generated output, and this workbook
# is the opposite of generated output - it is the evidence, and it belongs in
# the repository where it can be cited and its history read.
OUT = ROOT / "docs" / "evidence" / "Silent_Flyway_Data_Provenance.xlsx"

HEAD_FILL = PatternFill("solid", fgColor="1F3A4D")
HEAD_FONT = Font(color="FFFFFF", bold=True, size=10)
TITLE_FONT = Font(bold=True, size=13)
BASIS_FILL = {
    "documented": PatternFill("solid", fgColor="D6EFD8"),
    "secondary": PatternFill("solid", fgColor="FFF3CD"),
    "estimated": PatternFill("solid", fgColor="F8D7DA"),
}
THIN = Side(style="thin", color="BBBBBB")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def header(ws, row, cols, widths):
    for i, (c, w) in enumerate(zip(cols, widths), 1):
        cell = ws.cell(row, i, c)
        cell.fill = HEAD_FILL
        cell.font = HEAD_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row + 1, 1)


def wrap(ws, row, col, value, width_wrap=True):
    cell = ws.cell(row, col, value)
    cell.alignment = Alignment(vertical="top", wrap_text=width_wrap)
    cell.border = BORDER
    return cell


def smoothstep_at(anchors, year):
    """Same interpolation compose.py uses, so the workbook matches the piece."""
    a = sorted(anchors, key=lambda x: x["year"])
    if year <= a[0]["year"]:
        return float(a[0]["count"])
    if year >= a[-1]["year"]:
        return float(a[-1]["count"])
    for i in range(1, len(a)):
        if year <= a[i]["year"]:
            p, q = a[i - 1], a[i]
            u = (year - p["year"]) / (q["year"] - p["year"])
            s = u * u * (3 - 2 * u)
            return p["count"] + (q["count"] - p["count"]) * s
    return 0.0


def basis_at(anchors, year):
    a = sorted(anchors, key=lambda x: x["year"])
    for i in range(1, len(a)):
        if year <= a[i]["year"]:
            pair = {a[i - 1]["basis"], a[i]["basis"]}
            if "estimated" in pair:
                return "estimated"
            if "secondary" in pair:
                return "secondary"
            return "documented"
    return a[-1]["basis"]


def main() -> None:
    cfg = json.loads(SPECIES.read_text(encoding="utf-8"))
    ev = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    species = cfg["species"]
    metrics = cfg["_metrics"]
    tl = cfg["timeline"]
    y0, y1 = tl["start_year"], tl["end_year"]

    wb = Workbook()

    # ------------------------------------------------------------ read me
    ws = wb.active
    ws.title = "Read me"
    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 108
    ws["A1"] = "Silent Flyway - data provenance"
    ws["A1"].font = TITLE_FONT
    rows = [
        ("", ""),
        ("What this is",
         "The evidence behind a sound sculpture of Hong Kong bird decline. Every figure the piece "
         "plays is listed here with where it came from and how far it can be trusted."),
        ("Generated", "By analysis/export_evidence.py from species/species.json and docs/evidence-log.json. "
                      "Do not hand-edit: rerun the script instead, or the workbook and the artwork disagree."),
        ("", ""),
        ("BASIS CODES", "The single most important column in this workbook."),
        ("documented",
         "The cited source was opened and the figure read back off it, or derived by stated arithmetic "
         "from one that was. Safe to cite."),
        ("secondary",
         "From a compiled series that agrees with the verified figures around it, but whose individual "
         "year has not been checked against the primary report. Probably right. Not proof."),
        ("estimated",
         "A bound, a range, a period midpoint, or a placeholder. NOT a measurement. Never cite it as one."),
        ("", ""),
        ("METRICS",
         "Hong Kong does not count every bird the same way. Waterbirds are counted in Deep Bay; "
         "passerines are known from passage counts; widespread residents only from atlas occupancy. "
         "Figures are comparable WITHIN a metric and meaningless across metrics - a count of ducks and "
         "a percentage of occupied squares cannot be added."),
        ("", ""),
        ("Biggest open lead",
         "The Hong Kong Bird Report is freely downloadable for every year 1958-2014 from the legacy "
         "index at hkbws.org.hk/web/eng/bird_report_eng.htm (the current site lists only 1993 onward, "
         "which is why the older years were assumed lost). Each volume carries a Systematic List of that "
         "year's maximum counts. That is the route into the 1960-1996 gap."),
    ]
    for i, (a, b) in enumerate(rows, 3):
        ws.cell(i, 1, a).font = Font(bold=True, size=10)
        ws.cell(i, 1).alignment = Alignment(vertical="top")
        ws.cell(i, 2, b).alignment = Alignment(vertical="top", wrap_text=True)
        ws.row_dimensions[i].height = 30 if len(b) > 100 else 15

    # ------------------------------------------------------------ anchors
    ws = wb.create_sheet("Anchors")
    ws["A1"] = "Every figure the sculpture is built from"
    ws["A1"].font = TITLE_FONT
    header(ws, 3,
           ["Species", "Scientific name", "Year", "Figure", "Metric", "Basis", "Source", "Note"],
           [26, 22, 8, 10, 20, 13, 46, 74])
    r = 4
    n_doc = n_sec = n_est = 0
    for sp in species:
        m = metrics.get(sp["metric"], {})
        for a in sorted(sp["anchors"], key=lambda x: x["year"]):
            wrap(ws, r, 1, sp["common_name"], False)
            wrap(ws, r, 2, sp.get("scientific_name", ""), False)
            wrap(ws, r, 3, a["year"], False)
            wrap(ws, r, 4, a["count"], False)
            wrap(ws, r, 5, m.get("label", sp["metric"]), False)
            c = wrap(ws, r, 6, a["basis"], False)
            c.fill = BASIS_FILL.get(a["basis"], PatternFill())
            wrap(ws, r, 7, a.get("source") or "")
            wrap(ws, r, 8, a.get("note") or "")
            n_doc += a["basis"] == "documented"
            n_sec += a["basis"] == "secondary"
            n_est += a["basis"] == "estimated"
            r += 1
    ws.cell(r + 1, 1, f"documented {n_doc}   ·   secondary {n_sec}   ·   estimated {n_est}").font = Font(bold=True)

    # ------------------------------------------------- annual series
    ws = wb.create_sheet("Annual series")
    ws["A1"] = "One row per year - the curve the sculpture actually plays"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = ("Values between anchors are interpolated with the same smoothstep the composer uses. "
                "Interpolated years inherit the WEAKER basis of the two anchors bracketing them.")
    ws["A2"].alignment = Alignment(wrap_text=True)
    cols = ["Year"] + [s["common_name"] for s in species] + [f"{s['common_name']} - basis" for s in species]
    header(ws, 4, cols, [8] + [17] * len(species) + [17] * len(species))
    r = 5
    for year in range(y0, y1 + 1):
        wrap(ws, r, 1, year, False)
        for i, sp in enumerate(species):
            ext = sp.get("extirpated_year")
            gone = ext is not None and year > ext
            v = 0 if gone else round(smoothstep_at(sp["anchors"], year), 1)
            wrap(ws, r, 2 + i, "extirpated" if gone else v, False)
            b = basis_at(sp["anchors"], year)
            c = wrap(ws, r, 2 + len(species) + i, "-" if gone else b, False)
            if not gone:
                c.fill = BASIS_FILL.get(b, PatternFill())
        r += 1

    # ------------------------------------------------------------ verified
    ws = wb.create_sheet("Verified")
    ws["A1"] = "Checked against a live source - the sentence read back off the page"
    ws["A1"].font = TITLE_FONT
    header(ws, 3, ["Checked", "Species", "Claim", "Source URL", "Exact wording at the source"],
           [12, 24, 40, 50, 88])
    for i, v in enumerate(ev["verified"], 4):
        wrap(ws, i, 1, v["date"], False)
        wrap(ws, i, 2, v["species"], False)
        wrap(ws, i, 3, v["claim"])
        wrap(ws, i, 4, v["source"])
        wrap(ws, i, 5, v["quote"])

    # ------------------------------------------------------------ rejected
    ws = wb.create_sheet("Rejected")
    ws["A1"] = "Failed checking - kept so the same wrong number is not adopted twice"
    ws["A1"].font = TITLE_FONT
    header(ws, 3, ["Checked", "Claim", "Where it came from", "Why it was rejected"],
           [12, 52, 34, 100])
    for i, v in enumerate(ev["rejected"], 4):
        wrap(ws, i, 1, v["date"], False)
        wrap(ws, i, 2, v["claim"])
        wrap(ws, i, 3, v["origin"])
        wrap(ws, i, 4, v["reason"])

    # ------------------------------------------------------------ species
    ws = wb.create_sheet("Species")
    ws["A1"] = "Per-species summary"
    ws["A1"].font = TITLE_FONT
    header(ws, 3,
           ["Species", "Scientific name", "IUCN", "Metric", "Anchors", "documented",
            "First year", "Last year", "Peak", "Latest", "Extirpated", "Recording?", "Status note"],
           [26, 22, 22, 20, 9, 12, 10, 10, 9, 9, 11, 12, 100])
    r = 4
    for sp in species:
        a = sorted(sp["anchors"], key=lambda x: x["year"])
        has_audio = (ROOT / "calls" / f"{sp['slug']}.wav").exists()
        wrap(ws, r, 1, sp["common_name"], False)
        wrap(ws, r, 2, sp.get("scientific_name", ""), False)
        wrap(ws, r, 3, sp.get("iucn", ""), False)
        wrap(ws, r, 4, metrics.get(sp["metric"], {}).get("label", sp["metric"]), False)
        wrap(ws, r, 5, len(a), False)
        wrap(ws, r, 6, sum(1 for x in a if x["basis"] == "documented"), False)
        wrap(ws, r, 7, a[0]["year"], False)
        wrap(ws, r, 8, a[-1]["year"], False)
        wrap(ws, r, 9, max(x["count"] for x in a), False)
        wrap(ws, r, 10, a[-1]["count"], False)
        wrap(ws, r, 11, sp.get("extirpated_year") or "-", False)
        c = wrap(ws, r, 12, "yes" if has_audio else "needed", False)
        c.fill = BASIS_FILL["documented"] if has_audio else BASIS_FILL["estimated"]
        wrap(ws, r, 13, sp.get("_data_status", ""))
        r += 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)

    total = sum(len(s["anchors"]) for s in species)
    print(f"[write] {OUT}")
    print(f"  {len(species)} species, {total} anchors "
          f"({n_doc} documented, {n_sec} secondary, {n_est} estimated)")
    print(f"  {len(ev['verified'])} verified records, {len(ev['rejected'])} rejected claims")


if __name__ == "__main__":
    main()
