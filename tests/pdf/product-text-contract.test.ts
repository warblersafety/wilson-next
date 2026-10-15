import { expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { nativeRouteOptions, otherTextGeometry } from "../../src/server/pdf/product-text";

it("ties native route exports and Other text capacity to independent pinned-PDF metadata", async () => {
  const script = `import json,sys
from pypdf import PdfReader
r=PdfReader(sys.argv[1]);out={'routes':[],'other':[]}
for name,f in r.get_fields().items():
 if name.endswith('Route[0]'): out['routes'].append({'pairs':f['/Opt']})
for p in r.pages:
 for ref in p.get('/Annots',[]):
  f=ref.get_object();n=str(f.get('/T',''))
  if 'RouteOther' in n or 'FreqOther' in n:
   box=f['/Rect'];out['other'].append({'kind':'route' if 'RouteOther' in n else 'frequency','width':float(box[2])-float(box[0]),'da':f.get('/DA'),'maxLen':f.get('/MaxLen'),'border':f.get('/BS',{}).get('/W',0),'flags':f.get('/Ff')})
print(json.dumps(out))`;
  const { stdout } = await promisify(execFile)(process.env.PYPDF_PYTHON ?? "python3", ["-c", script, "assets/fda/form-fda-3500-09-2025.pdf"]);
  const { routes, other } = JSON.parse(stdout);
  expect(routes).toHaveLength(2); expect(other).toHaveLength(4);
  for (const route of routes) {
    expect(route.pairs).toEqual(nativeRouteOptions.map(value => [value, value]));
  }
  for (const field of other) {
    const geometry = otherTextGeometry[field.kind as keyof typeof otherTextGeometry];
    expect(field.width).toBeCloseTo(geometry.width, 3);
    expect(field.da).toBe(`/ArialMT ${geometry.fontSize.toFixed(2)} Tf 0 g`);
    expect(field.maxLen).toBeNull(); expect(field.border).toBe(0);
    expect(field.flags).toBe(8388609); // ReadOnly + DoNotScroll; never assume readback proves fit.
  }
});
