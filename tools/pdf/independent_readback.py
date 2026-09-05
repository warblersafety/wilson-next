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
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
