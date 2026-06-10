#!/usr/bin/env python3
"""
JobSpy runner — invoked by the Node JobSpyAdapter as a subprocess.

Prints a JSON array of job postings to stdout. Exits non-zero with a JSON error
object on stderr if JobSpy is not installed or the scrape fails. Kept tiny on
purpose: all product logic lives in TypeScript; this is just the JobSpy bridge.

Usage:
  python jobspy-runner.py --site naukri --query "data analyst" --location "India" --limit 20
"""
import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--location", default="India")
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    try:
        import pandas as pd
        from jobspy import scrape_jobs
    except ImportError:
        print(json.dumps({"error": "jobspy_not_installed"}), file=sys.stderr)
        return 3

    try:
        df = scrape_jobs(
            site_name=[args.site],
            search_term=args.query,
            location=args.location,
            results_wanted=args.limit,
            country_indeed="india",
        )
    except Exception as exc:  # surface scrape failures as structured error
        print(json.dumps({"error": "scrape_failed", "detail": str(exc)}), file=sys.stderr)
        return 4

    columns = ["title", "company", "location", "description", "job_url", "date_posted"]
    records = []
    for _, row in df.iterrows():
        record = {}
        for col in columns:
            value = row.get(col)
            record[col] = None if (value is None or pd.isna(value)) else value
        records.append(record)

    print(json.dumps(records, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
