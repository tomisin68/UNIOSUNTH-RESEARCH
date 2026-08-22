"""Entry point: pull the study data out of Firestore and produce the full analysis.

    python run_analysis.py                     # live data from Firestore
    python run_analysis.py --cached            # reuse the last download
    python run_analysis.py --sample            # synthetic data, for testing
    python run_analysis.py --pdf               # also bundle every figure into one PDF

Outputs land in analysis/output/:
    report.md          the written findings
    figures/*.png      publication-resolution figures (300 dpi)
    tables/*.csv       every statistic as a spreadsheet
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import config
import charts
import dataset
import firestore_client
import report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Analyse the UNIOSUNTH workload / IPC compliance dataset.")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--cached", action="store_true",
                        help="reuse the previously downloaded records")
    source.add_argument("--sample", nargs="?", const="", metavar="PATH",
                        help="use synthetic sample data instead of the real database")
    parser.add_argument("--pdf", action="store_true",
                        help="also write a single PDF containing every figure")
    parser.add_argument("--out", type=Path, default=config.OUTPUT_DIR,
                        help="output directory (default: analysis/output)")
    args = parser.parse_args()

    out_dir = args.out
    figure_dir = out_dir / "figures"
    table_dir = out_dir / "tables"
    config.TABLE_DIR = table_dir  # report.py writes a few extras straight here

    print("UNIOSUNTH nursing research — analysis")
    print("-" * 60)

    # ── Load ──────────────────────────────────────────────────────────────
    print("Loading records...")
    sample_path = None
    if args.sample is not None:
        sample_path = Path(args.sample) if args.sample else out_dir / "sample_records.json"
        if not sample_path.exists():
            print(f"  ! No sample file at {sample_path}")
            print("    Generate one first:  python make_sample_data.py")
            return 1
        source_label = f"synthetic sample ({sample_path.name}) — NOT real study data"
    elif args.cached:
        source_label = "cached download of Firestore"
    else:
        source_label = f"live Firestore ({config.FIREBASE_PROJECT_ID})"

    try:
        records = firestore_client.load_records(cached=args.cached, sample=sample_path)
    except (PermissionError, FileNotFoundError) as exc:
        print(f"  ! {exc}")
        return 1
    except Exception as exc:  # network, DNS, etc.
        print(f"  ! Could not reach Firestore: {exc}")
        print("    Try --cached to work from the last download.")
        return 1

    # ── Transform ─────────────────────────────────────────────────────────
    ds = dataset.build(records)
    print(f"  {ds.n} assessment(s) ready for analysis")
    if ds.integrity["score_mismatches"]:
        print(f"  ! {len(ds.integrity['score_mismatches'])} stored score(s) disagree "
              "with the recomputed value — see the report")

    # ── Figures ───────────────────────────────────────────────────────────
    print("Rendering figures...")
    charts.render_all(ds, figure_dir)
    if args.pdf:
        pdf_path = charts.render_pdf(ds, out_dir / "all_figures.pdf")
        print(f"  pdf     {pdf_path.name}")

    # ── Tables and report ─────────────────────────────────────────────────
    print("Computing statistics...")
    tables = report.build_tables(ds, table_dir)
    print(f"  {len(tables)} table(s) written")

    report_path = report.write_report(ds, tables, figure_dir,
                                      out_dir / "report.md", source_label)
    print("-" * 60)
    print(f"Report:  {report_path}")
    print(f"Figures: {figure_dir}  ({len(charts.FIGURES)} files)")
    print(f"Tables:  {table_dir}")
    if sample_path is not None:
        print("\nNOTE: this run used SYNTHETIC data. Nothing here describes real nurses.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
