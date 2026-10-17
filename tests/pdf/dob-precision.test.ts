import { expect, it } from 'vitest';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NextRequest } from 'next/server';
import { POST as pdfPost } from '../../app/api/case/pdf/route';
import { dobPrecisionCase, monthDob } from '../fixtures/dob-precision';
import { setContextFact, contextSource } from '../fixtures/reviewed-context';
import { projectForm3500, hasBaseEventDescription } from '../../src/domain/case/projection';
import { form3500ReportReference } from '../../src/server/pdf/narrative-continuation';
import { fillForm3500Projection } from '../../src/server/pdf/form-3500';
import { parseBrowserJourneyState, browserStateVersion } from '../../src/server/case/browser-state';
import { getJourneySnapshot } from '../../src/server/journey/service';
import { InMemoryCaseRepository } from '../../src/server/case/repository';
import { applyCaseCommand } from '../../src/domain/case/commands';
const comments = 'topmostSubform[0].Page3[0].AdditionalComments[0]', prefix = 'topmostSubform[0].Page1[0].SecA_Patient[0].', date = prefix + 'DateBirth[0]';
const ageKeys = ['Value', 'Years', 'Months', 'Weeks', 'Days'].map(x => prefix + 'Age' + x + '[0]');
async function pdf(c = dobPrecisionCase()) {
    const p = projectForm3500(c), r = await fillForm3500Projection(new Uint8Array(await readFile('assets/fda/form-fda-3500-09-2025.pdf')), p), path = join(await mkdtemp(join(tmpdir(), 'wilson231-')), 'dob-precision.pdf');
    await writeFile(path, r.output);
    const x = JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON ?? 'python3', ['tools/pdf/independent_readback.py', path, '--named', '--page-text'])).stdout);
    expect(r.readback.sections).toEqual({ ...p.sections, B: { ...p.sections.B, relevantTestContext: x.namedFields[comments] } });
    return { x, p, path };
}
it.each([monthDob, { precision: 'year' as const, year: '1970', wording: 'Birth year supplied as 1970' }])('selected partial DOB %j prints exact A2-linked wording/qualifier/source and clears all age controls without deriving age', async (value) => {
    const c = setContextFact(dobPrecisionCase(), 'patient:patient:dateOfBirth', { kind: 'known', value, qualifier: 'Fictional caregiver estimate' }), before = structuredClone(c), { x, p } = await pdf(c);
    expect(x.pageCount).toBe(8);
    expect(x.namedFields[date]).toBe('B6 comments');
    for (const k of ageKeys)
        expect([undefined, '', '/Off']).toContain(x.namedFields[k]);
    expect(x.namedFields[comments]).toContain('A2 date of birth wording:');
    expect(x.namedFields[comments]).toContain(value.wording);
    expect(x.namedFields[comments]).toContain('Fictional caregiver estimate');
    expect(p.sourceTrace['sections.B.relevantTestContext']).toEqual(expect.arrayContaining(c.patient.facts.dateOfBirth.resolvedValue!.sourceIds));
    expect(p.omissions.some(o => o.target === 'patient:patient:dateOfBirth' && o.reason === 'qualifier-not-included')).toBe(false);
    expect(c).toEqual(before);
});
it('complete DOB keeps native date and exact qualifier context, no partial marker', async () => {
    const c = setContextFact(dobPrecisionCase(), 'patient:patient:dateOfBirth', { kind: 'known', value: '1969-02-12', qualifier: 'Birth date estimated by fictional reporter' }), { x, p } = await pdf(c);
    expect(x.namedFields[date]).toBe('12-FEB-1969');
    expect(x.namedFields[comments]).toContain('A2 date of birth context: Birth date estimated by fictional reporter');
    expect(p.sections.A.dateOfBirthInComments).toBeUndefined();
});
it('known age plus partial DOB requires explicit A2 selection; API and adapter block until selection; switching suppresses unselected wording without losing facts', async () => {
    let c = setContextFact(setContextFact(dobPrecisionCase(), 'patient:patient:dateOfBirth', { kind: 'known', value: monthDob, qualifier: 'DOB uncertainty' }), 'patient:patient:a2Value', { kind: 'explicitly-absent' });
    expect((await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: c }), c.id)).outputIssues).toContainEqual(expect.objectContaining({ code: 'patient-a2-choice-required' }));
    await expect(pdf(c)).rejects.toThrow('explicit age or date-of-birth print choice');
    for (const mode of ['preview', 'download'])
        expect((await pdfPost(new NextRequest('http://wilson.test/api/case/pdf', { method: 'POST', headers: { host: 'wilson.test', origin: 'http://wilson.test', 'content-type': 'application/json' }, body: JSON.stringify({ mode, state: { version: browserStateVersion, stage: 'output', case: c, unrepresented: [] } }) }))).status).toBe(409);
    const before = structuredClone(c);
    for (const choice of ['age', 'date-of-birth', 'age'] as const) {
        c = setContextFact(c, 'patient:patient:a2Value', { kind: 'known', value: choice });
        const { x, p } = await pdf(c);
        expect(x.namedFields[date] ?? '').toBe(choice === 'age' ? '' : 'B6 comments');
        expect(x.namedFields[comments] ?? '').toContain(choice === 'age' ? '' : monthDob.wording);
        if (choice === 'age') {
            expect(x.namedFields[comments] ?? '').not.toContain(monthDob.wording);
            expect(p.sections.A.dateOfBirthInComments).toBeUndefined();
            expect(p.omissions).toContainEqual(expect.objectContaining({ target: 'patient:patient:dateOfBirth', reason: 'a2-alternative-not-selected' }));
        }
        expect(c.patient.facts.ageYears).toEqual(before.patient.facts.ageYears);
        expect(c.patient.facts.dateOfBirth).toEqual(before.patient.facts.dateOfBirth);
    }
});
it.each(['unknown', 'declined', 'inapplicable', 'explicitly-absent'] as const)('selected but unavailable DOB %s never falls back to retained age; correction invalidates old content/reference and preserves history', async (kind) => {
    const c = setContextFact(dobPrecisionCase(), 'patient:patient:dateOfBirth', { kind: 'known', value: monthDob }), a = setContextFact(c, 'patient:patient:dateOfBirth', { kind }), snapshot = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: a }), a.id), old = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: c }), c.id);
    expect(snapshot.downloadReady).toBe(false);
    expect(snapshot.outputIssues.some(i => i.code === 'patient-a2-choice-required')).toBe(true);
    expect(snapshot.projection.sections.A.ageYears).toBeUndefined();
    expect(snapshot.projection.sections.A.dateOfBirthInComments).toBeUndefined();
    expect(snapshot.projection.sections.B.relevantTestContext ?? '').not.toContain(monthDob.wording);
    expect(snapshot.reportContentKey).not.toBe(old.reportContentKey);
    expect(form3500ReportReference(snapshot.projection)).not.toBe(form3500ReportReference(old.projection));
    expect(a.patient.facts.dateOfBirth.supersededValues).toContainEqual(c.patient.facts.dateOfBirth.resolvedValue);
    expect(a.event).toEqual(c.event);
    expect(a.products).toEqual(c.products);
    expect(a.relevantTests).toEqual(c.relevantTests);
});
it('partial DOB alone prints without an A2 preference or derived age; genuinev30 lossless migration rejects falsely labelled partials and invalid DOB remains rejected', async () => {
    let c = setContextFact(dobPrecisionCase(), 'patient:patient:ageYears', { kind: 'unknown' });
    c = setContextFact(c, 'patient:patient:a2Value', { kind: 'explicitly-absent' });
    const s = { version: 'wilson-browser-state-v30', stage: 'output', case: c, unrepresented: [] };
    expect(parseBrowserJourneyState(s)).toEqual({ ...s, version: browserStateVersion });
    const partial = setContextFact(c, 'patient:patient:dateOfBirth', { kind: 'known', value: monthDob });
    expect(() => parseBrowserJourneyState({ ...s, case: partial })).toThrow();
    expect(parseBrowserJourneyState({ ...s, version: browserStateVersion, case: partial }).case).toEqual(partial);
    expect((await pdf(partial)).x.namedFields[date]).toBe('B6 comments');
    const invalid = structuredClone(c);
    invalid.patient.facts.dateOfBirth.resolvedValue!.value = { kind: 'known', value: '1969-02-30' };
    for (const version of [s.version, browserStateVersion])
        expect(() => parseBrowserJourneyState({ ...s, version, case: invalid })).toThrow();
});
it('pending/conflicting DOB alternatives stay unprinted until resolution, without inferring age or a print choice', () => {
    let c = dobPrecisionCase();
    const src = contextSource('DOB alternatives');
    c = applyCaseCommand(c, { type: 'attach-grounded-proposals', commandId: 'dob-options', expectedRevision: c.revision, products: [], sources: [src], proposals: [monthDob, { precision: 'year' as const, year: '1970', wording: 'Birth year supplied as 1970' }].map((value, i) => ({ proposalId: `dob-${i}`, groupId: 'dob-options', intent: 'alternative' as const, target: { entity: 'patient' as const, entityId: 'patient' as const, field: 'dateOfBirth' as const }, value: { kind: 'known' as const, value }, sourceIds: [src.id] })) }).case;
    expect(projectForm3500(c).sections.B.relevantTestContext ?? '').not.toContain(monthDob.wording);
    c = applyCaseCommand(c, { type: 'review-proposal-groups', commandId: 'accept-dob-options', expectedRevision: c.revision, decisions: [{ groupId: 'dob-options', action: 'accept' }] }).case;
    expect(c.patient.facts.dateOfBirth.state).toBe('conflicted');
    expect(projectForm3500(c).sections.A.dateOfBirthInComments).toBeUndefined();
    c = applyCaseCommand(c, { type: 'resolve-conflict', commandId: 'resolve-dob-option', expectedRevision: c.revision, target: { entity: 'patient', entityId: 'patient', field: 'dateOfBirth' }, chosenValueId: 'dob-1', source: contextSource('select-dob') }).case;
    expect(projectForm3500(c).sections.B.relevantTestContext).toContain('Birth year supplied as 1970');
    expect(c.patient.facts.ageYears).toEqual(dobPrecisionCase().patient.facts.ageYears);
    expect(c.patient.facts.a2Value).toEqual(dobPrecisionCase().patient.facts.a2Value);
});
it('dense DOB wording preserves general/test context with existing B6 pagination; glyph attribution follows selected DOB only and no clinical narrative is invented', async () => {
    const b = dobPrecisionCase(), wording = Array.from({ length: 110 }, (_, i) => `Fictional birth date line ${i + 1}: during 1969, exact month/day unavailable.`).join('\n'), c = setContextFact(setContextFact(setContextFact(b, `test:${b.relevantTests[0].id}:lowRange`, { kind: 'known', value: '4.0', qualifier: 'Fictional assay context' }), 'event:event:additionalComments', { kind: 'known', value: 'Fictional general comment' }), 'patient:patient:dateOfBirth', { kind: 'known', value: { precision: 'year', year: '1969', wording } }), { x } = await pdf(c);
    expect(x.pageCount).toBeGreaterThan(9);
    for (const text of ['Fictional birth date line 110', 'Fictional assay context', 'Fictional general comment'])
        expect(x.pageTexts.slice(8).join('\n')).toContain(text);
    for (const page of x.pageTexts.slice(8))
        expect(page).toContain(form3500ReportReference(projectForm3500(c)));
    const glyph = setContextFact(b, 'patient:patient:dateOfBirth', { kind: 'known', value: { ...monthDob, wording: 'Birth during February 1969 漢' } });
    expect((await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: glyph }), glyph.id)).outputIssues.some(i => i.targets.includes('patient:patient:dateOfBirth'))).toBe(true);
    const selectedAge = setContextFact(glyph, 'patient:patient:a2Value', { kind: 'known', value: 'age' });
    expect((await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: selectedAge }), selectedAge.id)).downloadReady).toBe(true);
    let sparse = c;
    for (const f of ['symptoms', 'problemDescription', 'treatments', 'outcome', 'dischargeDate'] as const)
        sparse = setContextFact(sparse, `event:event:${f}`, { kind: 'unknown' });
    for (const p of sparse.products)
        sparse = setContextFact(sparse, `product:${p.id}:stopped`, { kind: 'unknown' });
    expect(hasBaseEventDescription(sparse)).toBe(false);
});
it('adapter rejects dangling partial DOB or a simultaneous full native date; age plus pointer rejects explicit alternative conflict', async () => {
    const p = projectForm3500(setContextFact(dobPrecisionCase(), 'patient:patient:dateOfBirth', { kind: 'known', value: monthDob })), src = new Uint8Array(await readFile('assets/fda/form-fda-3500-09-2025.pdf'));
    await expect(fillForm3500Projection(src, { ...p, sections: { ...p.sections, B: { ...p.sections.B, relevantTestContext: 'Unlinked comments' } } })).rejects.toThrow('A2 partial DOB requires');
    await expect(fillForm3500Projection(src, { ...p, sections: { ...p.sections, A: { ...p.sections.A, dateOfBirth: '1969-02-12' } } })).rejects.toThrow('A2 partial DOB requires');
    await expect(fillForm3500Projection(src, { ...p, sections: { ...p.sections, A: { ...p.sections.A, ageYears: 57 } } })).rejects.toThrow('explicit age or date-of-birth print choice');
});
