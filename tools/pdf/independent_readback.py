#!/usr/bin/env python3
"""Read Slice 0 representative values with the approved independent parser."""

import json
import sys

from pypdf import PdfReader, __version__ as pypdf_version


def main() -> None:
    reader = PdfReader(sys.argv[1])
    if reader.is_encrypted:
        reader.decrypt("")
    fields = reader.get_fields()
    field_values = sorted(
        str(field.get("/V"))
        for field in fields.values()
        if field.get("/V") not in (None, "")
    )
    result = {
        "pypdfVersion": pypdf_version,
        "encrypted": reader.is_encrypted,
        "pageCount": len(reader.pages),
        "fieldValues": field_values,
    }
    if len(sys.argv) > 2 and sys.argv[2] == "--named":
        result["namedFields"] = {
            name: str(field.get("/V"))
            for name, field in fields.items()
            if field.get("/V") not in (None, "")
        }
    if "--laboratory-rows" in sys.argv:
        # Read visual rows from widget coordinates, independently of the app's
        # field-name table (the FDA suffixes do not follow visible row order).
        widgets = []
        columns = {"TestData": "testResult", "TLowRange": "lowRange", "THighRange": "highRange", "TDate": "date"}
        for ref in reader.pages[2].get("/Annots", []):
            widget = ref.get_object()
            name = str(widget.get("/T", ""))
            column = next((value for prefix, value in columns.items() if name.startswith(prefix)), None)
            if column:
                rect = widget["/Rect"]
                widgets.append((float(rect[1]), column, str(widget.get("/V", ""))))
        rows = []
        for y, column, value in sorted(widgets, reverse=True):
            if not rows or abs(rows[-1][0] - y) > 1:
                rows.append((y, {}))
            rows[-1][1][column] = value
        result["laboratoryRows"] = [values for _, values in rows]
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
