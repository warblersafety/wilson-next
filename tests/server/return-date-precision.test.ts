import { expect, it } from 'vitest';
import { parseQuotedFixture } from '../fixtures/source-references';
import { monthReturnDate, returnDateCase } from '../fixtures/return-date-precision';
import { knownValueMismatch } from '../../src/domain/case/value-contract';
import { InMemoryCaseRepository } from '../../src/server/case/repository';
import { performJourneyAction } from '../../src/server/journey/service';
it.each([monthReturnDate, { precision: 'year', year: '2029', wording: 'Return recorded during 2029' }, { ...monthReturnDate, wording: 'Fabricated return wording' }, { precision: 'year', year: '2029', wording: 'Year not stated' }])('grounds only exact source/year return precision %j without inferring availability or other dates', value => {
    const text = 'Fictional symptom. ' + (value.wording === 'Fabricated return wording' ? monthReturnDate.wording : value.wording);
    const r = parseQuotedFixture({ turn: 'correction', input: { id: 'return-input', type: 'correction', text, recordedAt: '2026-10-17T00:00:00Z' }, output: { products: [], proposals: [{ proposalReference: 'symptom', groupReference: 'symptom', intent: 'fact', target: { entity: 'event', field: 'symptoms' }, value: { kind: 'known', value: ['Fictional symptom'] }, evidenceQuote: text }, { proposalReference: 'return-date', groupReference: 'return-date', intent: 'correction', target: { entity: 'event', field: 'productReturnDate' }, value: { kind: 'known', value, qualifier: 'Exact day unavailable' }, evidenceQuote: text }] } }, (k, r) => `${k}-${r}`);
    if (value.wording === 'Fabricated return wording' || value.wording === 'Year not stated')
        expect(r.unrepresented).toContainEqual(expect.objectContaining({ field: 'productReturnDate', reason: 'evidence-not-found' }));
    else {
        expect(r.unrepresented).toEqual([]);
        expect(r.proposals[1].value).toEqual({ kind: 'known', value, qualifier: 'Exact day unavailable' });
    }
    expect(r.proposals.some(p => ['productAvailability', 'onsetDate', 'death', 'dateOfBirth'].includes(p.target.field))).toBe(false);
});
it('rejects invalid partials, arbitrary strings and malformed objects while DOB/report contracts stay unchanged', () => {
    for (const value of [{ ...monthReturnDate, year: '0000' }, { ...monthReturnDate, month: '13' }, { ...monthReturnDate, wording: '' }, { ...monthReturnDate, day: '01' }, '2028-02', '2028-02-30', 'two weeks later'])
        expect(knownValueMismatch({ entity: 'event', entityId: 'event', field: 'productReturnDate' }, { kind: 'known', value })).toBeTruthy();
    for (const target of [{ entity: 'patient' as const, entityId: 'patient' as const, field: 'dateOfBirth' as const }, { entity: 'event' as const, entityId: 'event' as const, field: 'reportDate' as const }])
        expect(knownValueMismatch(target, { kind: 'known', value: monthReturnDate })).toBeTruthy();
});
it.each([{ kind: 'known' as const, value: monthReturnDate, qualifier: 'Fictional return date uncertain' }, { kind: 'known' as const, value: '2028-02-12', qualifier: 'Fictional return date uncertain' }])('direct date correction retains readable precision and qualifier source, changing no other facts %j', async (value) => {
    const c = returnDateCase(), repo = new InMemoryCaseRepository({ initialCase: c });
    await performJourneyAction(repo, c.id, { action: 'set-fact', target: 'event:event:productReturnDate', value }, { propose: async () => {
            throw Error('Unexpected model call');
        } });
    const a = (await repo.load(c.id))!;
    expect(a.event.facts.productReturnDate.resolvedValue?.value).toEqual(value);
    const excerpt = a.event.facts.productReturnDate.resolvedValue!.sourceIds.map(id => a.sources.find(s => s.id === id)!.excerpt).join(' ');
    expect(excerpt).toContain('product return date');
    expect(excerpt).toContain('Fictional return date uncertain');
    if (typeof value.value !== 'string')
        expect(excerpt).toContain(monthReturnDate.wording);
    expect(excerpt).not.toContain('expiration');
    for (const f of Object.keys(c.event.facts))
        if (f !== 'productReturnDate')
            expect(a.event.facts[f as keyof typeof c.event.facts]).toEqual(c.event.facts[f as keyof typeof c.event.facts]);
    expect(a.products).toEqual(c.products);
    expect(a.patient).toEqual(c.patient);
    expect(a.relevantTests).toEqual(c.relevantTests);
});
