"""Independent pypdf inspection of actual continuation page text/positions/fonts."""
import json, sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
pages = []
for index, page in enumerate(reader.pages[8:], 9):
    runs = []
    def visitor(text, cm, tm, font, size):
        if text:
            runs.append({"text": text.removesuffix("\n"), "x": tm[4], "y": tm[5], "size": size,
                         "font": str((font or {}).get("/BaseFont", ""))})
    page.extract_text(visitor_text=visitor)
    pages.append({"pdfPage": index, "width": float(page.mediabox.width), "height": float(page.mediabox.height), "runs": runs})
print(json.dumps({"pageCount": len(reader.pages), "fields": {name: field.get("/V") for name, field in (reader.get_fields() or {}).items() if "/V" in field}, "pages": pages}, ensure_ascii=False))
