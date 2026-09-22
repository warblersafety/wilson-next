"""Independent byte readback of the four retained synthetic downloads."""
from pathlib import Path
from pypdf import PdfReader, __version__
import hashlib
import json

root = Path(__file__).parent
names = ['live-before-correction', 'live-before-direct-correction', 'live-after-clinical-correction', 'live-final']
results = []
for name in names:
    path = root / (name + '.pdf')
    reader = PdfReader(path)
    fields = {key: value.get('/V') for key, value in reader.get_fields().items()}
    a = 'topmostSubform[0].Page1[0].SecA_Patient[0].'
    b = 'topmostSubform[0].Page3[0].TestDataTable[0].'
    d = 'topmostSubform[0].Page4[0].Prod1[0].'
    g = 'topmostSubform[0].Page7[0].SecG_Reporter[0].'
    result = '9.6' if name in ['live-after-clinical-correction', 'live-final'] else '9.4'
    expected = {
        a+'AgeValue[0]': '54', a+'SexF[0]': '/1', a+'RepAdverse[0]': '/1', a+'Hospital[0]': '/1',
        b+'Row1[0].TestData1[0]': 'Hemoglobin: 8.9 g/dL', b+'Row1[0].TDate1[0]': '11-SEP-2026',
        b+'Row2[0].TestData2[0]': 'Hemoglobin: '+result+' g/dL', b+'Row2[0].TDate2[0]': '12-SEP-2026',
        **{b+f'Row{i}[0].T{side}Range{i}[0]': value for i in [1, 2] for side, value in [('Low','12 g/dL'),('High','16 g/dL')]},
        d+'Prod1Name[0]': 'ibuprofen', d+'Prod1Dose[0]': '400', d+'Prod1Route[0]': 'Oral', d+'Prod1Freq[0]': 'TID',
        d+'Prod1TherapyStartDate[0]': '08-SEP-2026', d+'Prod1TherapyStopDate[0]': '11-SEP-2026',
        d+'Prod1AbatedYes[0]': '/1', d+'Prod1ReappearNA[0]': '/1', d+'Prod1ReappearYes[0]': '/Off', d+'Prod1ReappearNo[0]': '/Off',
        g+'FirstName[0]': 'Casey', g+'LastName[0]': 'Reed', g+'IdentityNo[0]': '/1', g+'Occupation[0]': 'Physician',
        g+'Email[0]': 'casey.updated@example.test' if name == 'live-final' else 'casey.reed@example.test',
    }
    assert len(reader.pages) == 8
    for key, value in expected.items():
        assert fields[key] == value, (name, key, fields[key], value)
    if results:
        previous = results[-1]['fields']
        changes = {k: {'before': previous.get(k), 'after': fields.get(k)} for k in fields.keys() | previous.keys() if fields.get(k) != previous.get(k)}
        assert set(changes) == (set() if name == 'live-before-direct-correction' else {b+'Row2[0].TestData2[0]'} if name == 'live-after-clinical-correction' else {g+'Email[0]'}), changes
    else:
        changes = {}
    results.append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'pages': len(reader.pages), 'verifiedFields': expected, 'changesFromPrevious': changes, 'fields': fields})
for item in results:
    item['eventDescription'] = item.pop('fields')['topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]']
(root / 'download-readback.json').write_text(json.dumps({'reader': 'pypdf '+__version__, 'result': 'pass', 'downloads': results}, indent=2)+'\n')
print('Four PDF downloads passed; only the intended result and reporter email changed.')
