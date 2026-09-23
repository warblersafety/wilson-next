"""Source-authored checks against stored first-pass proposals, accepted facts and pypdf readback.
This evaluates retained evidence only; it cannot call the model or affect runtime.
"""
import json, pathlib, re, sys
root = pathlib.Path(__file__).parent
batch = sys.argv[1] if len(sys.argv) > 1 else 'remediation'
assert batch in ['remediation', 'final']
results = json.loads((root/(batch+'-results.json')).read_text())
checks = {
 'recheck-mixed-complaint': {'symptoms': ['burning', 'unsteady', r'den\w* trouble breathing'], 'problem': ['cracked', 'powder'], 'products': [('minocycline', ['one capsule', '100 mg'], ['100 mg'])]},
 'recheck-ambiguous-dose': {'symptoms': ['queasiness', r'den\w* vomiting'], 'problem': [r'possib|uncertain|not confirmed', 'packaging'], 'products': [('doxycycline', None, None), ('ibuprofen', None, None)]},
 'fresh-defect-and-denial': {'symptoms': ['mouth', 'numb', 'tongue', 'tingl', r'den\w*.*wheez', r'(did not|no|den\w*).*faint'], 'problem': ['damp', 'crumbl'], 'products': [('clarithromycin', [r'one and a half|1.5', 'tablets', '750 mg'], ['500 mg'])]},
 'fresh-uncertain-manifestation': {'symptoms': ['muffled hearing', r'may|possib|uncertain|not sure'], 'problem': None, 'products': [('furosemide', ['one tablet', '40 mg', r'reported|uncertain'], None)]},
 'fresh-quality-negative': {'symptoms': None, 'problem': ['loose cap', 'thread'], 'products': [('Optivex', None, ['5 mg/mL'])]},
 'fresh-count-attribution': {'symptoms': ['intermittent', 'buzzing', 'left ear', r'without ear pain|no ear pain'], 'problem': None, 'products': [('aspirin', ['two caplets'], ['325 mg']), ('famotidine', ['one tablet', '20 mg'], None)]},
}
checks['final-count-attribution'] = checks['fresh-count-attribution']
checks.update({
 'final-denied-defect': {'symptoms': ['flushing', 'shaky', 'no chest pain'], 'problem': None, 'products': [('prednisone', ['three tablets', '15 mg'], ['5 mg'])]},
 'final-unmentioned-defect': {'symptoms': ['dry tickling cough', r'den\w* fever'], 'problem': None, 'problemKind': 'empty', 'products': [('losartan', ['one tablet', '25 mg'], None)]},
 'final-unknown-defect': {'symptoms': ['itchy spots', 'both forearms', r'not certain|unsure|uncertain', r'den\w* facial swelling'], 'problem': None, 'problemKind': 'unknown', 'products': [('fluconazole', ['one capsule', '50 mg', r'unsure|uncertain'], None)]},
})
def text(value):
    return (' and '.join(value['value']) if isinstance(value.get('value'), list) else str(value.get('value', ''))) + ' ' + value.get('qualifier','')
def match(patterns, actual):
    for pattern in patterns: assert re.search(pattern, actual, re.I), (pattern, actual)
def facts(row, stage, entity, field, ident=None):
    return [v['value'] for f in row[stage+'Facts'] if f['entity']==entity and f['field']==field and (ident is None or f['entityId']==ident) for v in f['values']]
assessments=[]
for row in results['cases']:
    ident=row['id']; expected=checks[ident]
    try:
        assert row.get('downloaded') and not row.get('failure'), row.get('failure')
        assert row['unrepresented']==[] and row['pendingPdfBlocked'] and not row['pendingDownloadReady']
        for field, patterns in [('symptoms', expected['symptoms']), ('problemDescription', expected['problem'])]:
            proposed=facts(row,'proposed','event',field);accepted=facts(row,'accepted','event',field)
            kind = expected.get('problemKind', 'explicitly-absent') if field == 'problemDescription' else 'explicitly-absent'
            if kind == 'empty':
                assert proposed == accepted == [], (field, proposed, accepted)
                continue
            assert len(proposed)==1 and proposed==accepted, (field, proposed, accepted)
            if patterns is None: assert accepted==[{'kind':kind}], (field,accepted)
            else:
                assert accepted[0]['kind']=='known'
                match(patterns,text(accepted[0]))
                desc=row['independentPdfFields']['topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]']
                match(patterns,desc)
        products=[f for f in row['acceptedFacts'] if f['entity']=='product' and f['field']=='name']
        assert len(products)==len(expected['products'])
        for name,dose,strength in expected['products']:
            entity=next(f['entityId'] for f in products if name.lower() in text(f['values'][0]['value']).lower())
            slot=next(n for n in [1,2] if name.lower() in row['independentPdfFields'].get(f'topmostSubform[0].Page{n+3}[0].Prod{n}[0].Prod{n}Name[0]','').lower())
            prefix=f'topmostSubform[0].Page{slot+3}[0].Prod{slot}[0].Prod{slot}'
            for field,patterns in [('dose',dose),('strength',strength)]:
                values=facts(row,'accepted','product',field,entity)
                if patterns is None:
                    assert not any(v['kind']=='known' for v in values), (name,field,values)
                    assert prefix+field.title()+'[0]' not in row['independentPdfFields'], (name,field)
                else:
                    assert len(values)==1 and values[0]['kind']=='known'
                    match(patterns,text(values[0]))
                    pdfvalue=row['independentPdfFields'][prefix+field.title()+'[0]']
                    # Independent control readback: simple quantities may split
                    # amount/unit; compound descriptions must remain literal.
                    for pattern in patterns:
                        quantity=re.fullmatch(r'(\d+) mg',pattern)
                        if quantity and pdfvalue==quantity[1]:
                            assert row['independentPdfFields'][prefix+field.title()+'Unit[0]']=='25'
                        elif pattern=='5 mg/mL' and pdfvalue=='5':
                            assert row['independentPdfFields'][prefix+field.title()+'Unit[0]']=='29'
                        else: match([pattern],pdfvalue)
        if ident in ['fresh-count-attribution','final-count-attribution']:
            assert '650' not in json.dumps(row['acceptedFacts'])
        if ident=='recheck-ambiguous-dose':
            assert not any(f['field']=='dose' and any(v['value']['kind']=='known' for v in f['values']) for f in row['proposedFacts'])
        assessments.append({'id':ident,'result':'pass','scope':'Source-defined targeted placement, negation/uncertainty, independent product quantities, explicit acceptance and PDF fields. Not a general clinical or reliability score.'})
    except (AssertionError,KeyError,StopIteration) as error:
        assessments.append({'id':ident,'result':'FAIL','detail':str(error)})
(root/(batch+'-assessment.json')).write_text(json.dumps({'assessments':assessments},indent=2)+'\n')
print(json.dumps(assessments,indent=2))
assert len(assessments)==(6 if batch == 'remediation' else 4) and all(a['result']=='pass' for a in assessments)
