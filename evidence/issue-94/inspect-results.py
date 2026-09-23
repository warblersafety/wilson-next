"""Independent PDF readback and compact source/proposal/accepted evidence. No model calls."""
import json, pathlib, sys
from pypdf import PdfReader
root = pathlib.Path(__file__).parent
results_file = root / (sys.argv[1] if len(sys.argv) > 1 else 'live-results.json')
results = json.loads(results_file.read_text())

def facts(case, pending=False):
    out = []
    for kind, entities in [('patient', [case['patient']]), ('event', [case['event']]), ('product', case['products']), ('test', case['relevantTests'])]:
        for entity in entities:
            for key, fact in entity['facts'].items():
                values = fact['proposedValues'] if pending else ([fact['resolvedValue']] if fact.get('resolvedValue') else [])
                if values:
                    out.append({'entity': kind, 'entityId': entity['id'], 'field': key, 'values': [{'value': v['value'], 'sourceIds': v['sourceIds']} for v in values]})
    return out

for row in results['cases']:
    ident = row['id']
    proposed = root / (ident + '-proposed.json')
    accepted = root / (ident + '-accepted.json')
    if proposed.exists():
        c = json.loads(proposed.read_text())['state']['case']
        row['proposedFacts'] = facts(c, True)
        row['sources'] = c['sources']
    if accepted.exists():
        c = json.loads(accepted.read_text())['state']['case']
        row['acceptedFacts'] = facts(c)
        row['sources'] = c['sources']
    pdf = root / (ident + '.pdf')
    if pdf.exists():
        reader = PdfReader(pdf)
        row['independentPdfFields'] = {k: str(v.get('/V')) for k,v in reader.get_fields().items() if v.get('/V') is not None and str(v.get('/V')).strip() not in ['', '/Off']}
results_file.write_text(json.dumps(results, indent=2) + '\n')
for row in results['cases']:
    print(row['id'], row.get('failure', 'downloaded' if row.get('downloaded') else 'pending'))
    for f in row.get('proposedFacts', []):
        if f['field'] in ['symptoms','problemDescription','dose','strength','name']:
            print(' ', f['entity'], f['field'], [v['value'] for v in f['values']])
