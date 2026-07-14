#!/usr/bin/env python3
"""Regenerate src/dictionary.json from the LOCKED v6 field-dictionary spreadsheet.

The spreadsheet is the single source of truth. Run this whenever it changes:
    python3 tools/build-schema.py [optional path to .xlsx]

Requires openpyxl (pip install openpyxl).
"""
import json, os, sys
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_XLSX = os.path.join(HERE, "..", "..", "RCS_OCAF_Schema_Field_Dictionary_v6.xlsx")
OUT = os.path.join(HERE, "..", "src", "dictionary.json")

COLUMNS = ["num", "key", "group", "type", "cls", "source", "pdf_extract",
           "used_in_docs", "provenance", "req", "gates_manor", "crossroads", "notes"]

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSX
    wb = openpyxl.load_workbook(src, data_only=True)
    ws = wb["Field Dictionary"]
    rows = list(ws.iter_rows(values_only=True))
    fields = []
    for r in rows[1:]:                       # skip header
        if r[0] is None and r[1] is None:    # skip blank rows
            continue
        fields.append({COLUMNS[i]: (r[i] if i < len(r) else None) for i in range(len(COLUMNS))})
    with open(OUT, "w") as f:
        json.dump(fields, f, indent=2, default=str)
    print(f"wrote {len(fields)} fields -> src/dictionary.json  (from {os.path.basename(src)})")

if __name__ == "__main__":
    main()
