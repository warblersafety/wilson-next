import { expect, it } from 'vitest';
import { emptyFact } from '../../src/domain/case/internal';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { returnDateCase, monthReturnDate } from '../fixtures/return-date-precision';
import { setContextFact, contextSource } from '../fixtures/reviewed-context';
import { projectForm3500, hasBaseEventDescription } from '../../src/domain/case/projection';
import { form3500ReportReference } from '../../src/server/pdf/narrative-continuation';
import { fillForm3500Projection } from '../../src/server/pdf/form-3500';
import { parseBrowserJourneyState, browserStateVersion } from '../../src/server/case/browser-state';
import { getJourneySnapshot } from '../../src/server/journey/service';
import { InMemoryCaseRepository } from '../../src/server/case/repository';
import { applyCaseCommand } from '../../src/domain/case/commands';
const comments = 'topmostSubform[0].Page3[0].AdditionalComments[0]', date = 'topmostSubform[0].Page3[0].TestDataTable[0].ReturnDate[0]';
async function pdf(c = returnDateCase()) {
    const p = projectForm3500(c), r = await fillForm3500Projection(new Uint8Array(await readFile('assets/fda/form-fda-3500-09-2025.pdf')), p), path = join(await mkdtemp(join(tmpdir(), 'wilson229-')), 'return-date.pdf');
    await writeFile(path, r.output);
    const x = JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON ?? 'python3', ['tools/pdf/independent_readback.py', path, '--named', '--page-text'])).stdout);
    expect(r.readback.sections).toEqual({ ...p.sections, B: { ...p.sections.B, relevantTestContext: x.namedFields[comments] } });
    return { x, p, path };
}
it.each([monthReturnDate, { precision: 'year' as const, year: '2029', wording: 'Return recorded during 2029' }])('C1 preserves supplied precision %j and qualifier/source in linked Additional comments with no inferred date or facts', async (value) => {
    const c = setContextFact(returnDateCase(), 'event:event:productReturnDate', { kind: 'known', value, qualifier: 'Return day uncertain' }), before = structuredClone(c), { x, p } = await pdf(c);
    expect(x.pageCount).toBe(8);
    expect(x.namedFields[date]).toBe('B6 comments');
    expect(x.namedFields[comments]).toContain('C1 product return date wording:');
    expect(x.namedFields[comments]).toContain(value.wording);
    expect(x.namedFields[comments]).toContain('Return day uncertain');
    expect(p.sections.C.productReturnDate).toBeUndefined();
    expect(p.sourceTrace['sections.B.relevantTestContext']).toEqual(expect.arrayContaining(c.event.facts.productReturnDate.resolvedValue!.sourceIds));
    expect(p.omissions.some(o => o.target === 'event:event:productReturnDate' && o.reason === 'qualifier-not-included')).toBe(false);
    expect((await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: c }), c.id)).downloadReady).toBe(true);
    expect(c).toEqual(before);
});
it('complete native baseline retains formatting; full return-date qualifier has labelled comments without partial marker', async () => {
    const c = setContextFact(returnDateCase(), 'event:event:productReturnDate', { kind: 'known', value: '2028-02-12', qualifier: 'Fictional reporter estimated date' }), { x, p } = await pdf(c);
    expect(x.namedFields[date]).toBe('12-FEB-2028');
    expect(x.namedFields[comments]).toContain('C1 product return date context: Fictional reporter estimated date');
    expect(p.sections.C.productReturnDateInComments).toBeUndefined();
    expect(p.omissions.some(o => o.target === 'event:event:productReturnDate' && o.reason === 'qualifier-not-included')).toBe(false);
});
it.each(['available', 'not-available', 'unknown', 'declined', 'empty', 'conflicted'] as const)('retains partial date but never prints or infers return when availability %s', async (state) => {
    let c = setContextFact(returnDateCase(), 'event:event:productReturnDate', { kind: 'known', value: monthReturnDate, qualifier: 'Date uncertain' });
    const prior = structuredClone(c.event.facts.productReturnDate);
    if (state === 'empty') {
        c=structuredClone(c);
        c.event.facts.productAvailability = emptyFact();
    }
    else
        c = setContextFact(c, 'event:event:productAvailability', state === 'available' || state === 'not-available' ? { kind: 'known', value: state } : { kind: state === 'conflicted' ? 'unknown' : state });
    if (state === 'conflicted') {
        const src = contextSource('availability-dispute');
        c = applyCaseCommand(c, { type: 'attach-grounded-proposals', commandId: 'availability-options', expectedRevision: c.revision, products: [], sources: [src], proposals: ['available', 'returned-to-manufacturer'].map((value, i) => ({ proposalId: `availability-${i}`, groupId: 'availability', intent: 'alternative' as const, target: { entity: 'event' as const, entityId: 'event' as const, field: 'productAvailability' as const }, value: { kind: 'known' as const, value }, sourceIds: [src.id] })) }).case;
        c = applyCaseCommand(c, { type: 'review-proposal-groups', commandId: 'accept-availability', expectedRevision: c.revision, decisions: [{ groupId: 'availability', action: 'accept' }] }).case;
    }
    const p = projectForm3500(c);
    expect(p.sections.C.productReturnDateInComments).toBeUndefined();
    expect(p.sections.C.productReturnDate).toBeUndefined();
    expect(p.sections.B.relevantTestContext ?? '').not.toContain(monthReturnDate.wording);
    expect(p.notIncluded.join(' ')).toContain('return to manufacturer is not explicitly selected');
    expect(c.event.facts.productReturnDate).toEqual(prior);
    c = state === 'conflicted' ? applyCaseCommand(c, { type: 'resolve-conflict', commandId: 'resolve-availability', expectedRevision: c.revision, target: { entity: 'event', entityId: 'event', field: 'productAvailability' }, chosenValueId: 'availability-1', source: contextSource('choose-returned') }).case : setContextFact(c, 'event:event:productAvailability', { kind: 'known', value: 'returned-to-manufacturer' });
    expect((await pdf(c)).x.namedFields[date]).toBe('B6 comments');
});
it('correction and all explicit statuses invalidate content/reference and remove obsolete wording; other facts/history retained', async () => {
    const c = setContextFact(returnDateCase(), 'event:event:productReturnDate', { kind: 'known', value: monthReturnDate });
    const key = async (s: typeof c) => (await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: s }), s.id)).reportContentKey;
    for (const value of [{ kind: 'known' as const, value: { precision: 'year' as const, year: '2030', wording: 'Return recorded during 2030' }, qualifier: 'Current return context' }, ...(['unknown', 'declined', 'inapplicable', 'explicitly-absent'] as const).map(kind => ({ kind }))]) {
        const a = setContextFact(c, 'event:event:productReturnDate', value);
        expect(await key(a)).not.toBe(await key(c));
        expect(form3500ReportReference(projectForm3500(a))).not.toBe(form3500ReportReference(projectForm3500(c)));
        expect(projectForm3500(a).sections.B.relevantTestContext ?? '').not.toContain(monthReturnDate.wording);
        expect(a.patient).toEqual(c.patient);
        expect(a.products).toEqual(c.products);
        expect(a.relevantTests).toEqual(c.relevantTests);
        expect(a.event.facts.productAvailability).toEqual(c.event.facts.productAvailability);
        expect(a.event.facts.productReturnDate.supersededValues).toContainEqual(c.event.facts.productReturnDate.resolvedValue);
    }
});
it('genuine v29 migration is lossless; partial falsely labelled v29 rejects; legacy impossible date retained but blocks output', async () => {
    const c = returnDateCase(), s = { version: 'wilson-browser-state-v29', stage: 'output', case: c, unrepresented: [] };
    expect(parseBrowserJourneyState(s)).toEqual({ ...s, version: browserStateVersion });
    const p = setContextFact(c, 'event:event:productReturnDate', { kind: 'known', value: monthReturnDate });
    expect(() => parseBrowserJourneyState({ ...s, case: p })).toThrow();
    expect(parseBrowserJourneyState({ ...s, version: browserStateVersion, case: p }).case).toEqual(p);
    const invalid = structuredClone(c);
    invalid.event.facts.productReturnDate.resolvedValue!.value = { kind: 'known', value: '2028-02-30' };
    expect(parseBrowserJourneyState({ ...s, case: invalid }).case).toEqual(invalid);
    expect((await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: invalid }), invalid.id)).downloadReady).toBe(false);
});
it('pending/conflicted dates do not print until explicit resolution; no new test or clinical narrative generated', async () => {
    let c = returnDateCase();
    const src = contextSource('return alternatives');
    c = applyCaseCommand(c, { type: 'attach-grounded-proposals', commandId: 'return-alternatives', expectedRevision: c.revision, products: [], sources: [src], proposals: [monthReturnDate, { precision: 'year' as const, year: '2029', wording: 'Return during 2029' }].map((value, i) => ({ proposalId: `return-${i}`, groupId: 'return', intent: 'alternative' as const, target: { entity: 'event' as const, entityId: 'event' as const, field: 'productReturnDate' as const }, value: { kind: 'known' as const, value }, sourceIds: [src.id] })) }).case;
    expect(projectForm3500(c).sections.B.relevantTestContext ?? '').not.toContain(monthReturnDate.wording);
    c = applyCaseCommand(c, { type: 'review-proposal-groups', commandId: 'accept-return', expectedRevision: c.revision, decisions: [{ groupId: 'return', action: 'accept' }] }).case;
    expect(c.event.facts.productReturnDate.state).toBe('conflicted');
    expect(projectForm3500(c).sections.B.relevantTestContext ?? '').not.toContain('Return during 2029');
    c = applyCaseCommand(c, { type: 'resolve-conflict', commandId: 'resolve-return', expectedRevision: c.revision, target: { entity: 'event', entityId: 'event', field: 'productReturnDate' }, chosenValueId: 'return-1', source: contextSource('select-return') }).case;
    expect(projectForm3500(c).sections.B.relevantTestContext).toContain('Return during 2029');
    for (const field of ['symptoms', 'problemDescription', 'treatments', 'outcome', 'dischargeDate'] as const)
        c = setContextFact(c, `event:event:${field}`, { kind: 'unknown' });
    for (const p of c.products)
        c = setContextFact(c, `product:${p.id}:stopped`, { kind: 'unknown' });
    expect(hasBaseEventDescription(c)).toBe(false);
    expect(c.relevantTests).toEqual(returnDateCase().relevantTests);
});
it('dense C1 wording shares comments pagination/reference with other context; glyph issues target actual return date', async () => {
    const wording = Array.from({ length: 110 }, (_, i) => `Fictional return date line ${i + 1}: during 2028; day not supplied.`).join('\n'), base = returnDateCase(), c = setContextFact(setContextFact(setContextFact(base, `test:${base.relevantTests[0].id}:lowRange`, { kind: 'known', value: '4.0', qualifier: 'Fictional assay limit context' }), 'event:event:additionalComments', { kind: 'known', value: 'Fictional independent comment' }), 'event:event:productReturnDate', { kind: 'known', value: { precision: 'year', year: '2028', wording } }), { x } = await pdf(c);
    expect(x.pageCount).toBeGreaterThan(9);
    expect(x.pageTexts.slice(8).join('\n')).toContain('Fictional return date line 110');
    expect(x.pageTexts.slice(8).join('\n')).toContain('Fictional independent comment');
    expect(x.pageTexts.slice(8).join('\n')).toContain('Fictional assay limit context');
    for (const page of x.pageTexts.slice(8))
        expect(page).toContain(form3500ReportReference(projectForm3500(c)));
    const glyph = setContextFact(c, 'event:event:productReturnDate', { kind: 'known', value: { ...monthReturnDate, wording: 'Return during February 2028 漢' } }), snap = await getJourneySnapshot(new InMemoryCaseRepository({ initialCase: glyph }), glyph.id);
    expect(snap.downloadReady).toBe(false);
    expect(snap.outputIssues.some(i => i.targets.includes('event:event:productReturnDate'))).toBe(true);
});
it('adapter rejects C1 pointer without explicit return, with complete native date, or without labelled linked comments', async () => {
    const c = setContextFact(returnDateCase(), 'event:event:productReturnDate', { kind: 'known', value: monthReturnDate }), p = projectForm3500(c), source = new Uint8Array(await readFile('assets/fda/form-fda-3500-09-2025.pdf'));
    for (const C of [{ ...p.sections.C, productAvailability: 'available' as const }, { ...p.sections.C, productReturnDate: '2028-02-12' }])
        await expect(fillForm3500Projection(source, { ...p, sections: { ...p.sections, C } })).rejects.toThrow('C1 partial return date requires');
    await expect(fillForm3500Projection(source, { ...p, sections: { ...p.sections, B: { ...p.sections.B, relevantTestContext: 'Unlinked comments' } } })).rejects.toThrow('C1 partial return date requires');
});
