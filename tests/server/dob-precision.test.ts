import { expect, it } from 'vitest';
import { parseQuotedFixture } from '../fixtures/source-references';
import { monthDob, dobPrecisionCase } from '../fixtures/dob-precision';
import { knownValueMismatch } from '../../src/domain/case/value-contract';
import { InMemoryCaseRepository } from '../../src/server/case/repository';
import { performJourneyAction } from '../../src/server/journey/service';
it.each([monthDob, { precision: 'year', year: '2029', wording: 'Birth year supplied as 2029' }, { ...monthDob, wording: 'Fabricated DOB wording' }, { precision: 'year', year: '2029', wording: 'Year not stated' }])('grounds only exact source/year DOB precision %j without inferring availability or other dates', value => {
    const text = 'Fictional symptom. ' + (value.wording === 'Fabricated DOB wording' ? monthDob.wording : value.wording);
    const r = parseQuotedFixture({ turn: 'correction', input: { id: 'dob-input', type: 'correction', text, recordedAt: '2026-10-17T00:00:00Z' }, output: { products: [], proposals: [{ proposalReference: 'symptom', groupReference: 'symptom', intent: 'fact', target: { entity: 'event', field: 'symptoms' }, value: { kind: 'known', value: ['Fictional symptom'] }, evidenceQuote: text }, { proposalReference: 'dob-date', groupReference: 'dob-date', intent: 'correction', target: { entity: 'patient', field: 'dateOfBirth' }, value: { kind: 'known', value, qualifier: 'Exact day unavailable' }, evidenceQuote: text }] } }, (k, r) => `${k}-${r}`);
    if (value.wording === 'Fabricated DOB wording' || value.wording === 'Year not stated')
        expect(r.unrepresented).toContainEqual(expect.objectContaining({ field: 'dateOfBirth', reason: 'evidence-not-found' }));
    else {
        expect(r.unrepresented).toEqual([]);
        expect(r.proposals[1].value).toEqual({ kind: 'known', value, qualifier: 'Exact day unavailable' });
    }
    expect(r.proposals.some(p => ['productAvailability', 'onsetDate', 'death', 'a2Value', 'ageYears'].includes(p.target.field))).toBe(false);
});
it('rejects invalid partials, arbitrary strings and malformed objects while report contracts stay unchanged', () => {
    for (const value of [{ ...monthDob, year: '0000' }, { ...monthDob, month: '13' }, { ...monthDob, wording: '' }, { ...monthDob, day: '01' }, '2028-02', '2028-02-30', 'two weeks later'])
        expect(knownValueMismatch({ entity: 'patient', entityId: 'patient', field: 'dateOfBirth' }, { kind: 'known', value })).toBeTruthy();
    for (const target of [{ entity: 'event' as const, entityId: 'event' as const, field: 'reportDate' as const }])
        expect(knownValueMismatch(target, { kind: 'known', value: monthDob })).toBeTruthy();
});
it.each([{ kind: 'known' as const, value: monthDob, qualifier: 'Fictional birth date uncertain' }, { kind: 'known' as const, value: '2028-02-12', qualifier: 'Fictional birth date uncertain' }])('direct date correction retains readable precision and qualifier source, changing no other facts %j', async (value) => {
    const c = dobPrecisionCase(), repo = new InMemoryCaseRepository({ initialCase: c });
    await performJourneyAction(repo, c.id, { action: 'set-fact', target: 'patient:patient:dateOfBirth', value }, { propose: async () => {
            throw Error('Unexpected model call');
        } });
    const a = (await repo.load(c.id))!;
    expect(a.patient.facts.dateOfBirth.resolvedValue?.value).toEqual(value);
    const excerpt = a.patient.facts.dateOfBirth.resolvedValue!.sourceIds.map(id => a.sources.find(s => s.id === id)!.excerpt).join(' ');
    expect(excerpt).toContain('date of birth');
    expect(excerpt).toContain('Fictional birth date uncertain');
    if (typeof value.value !== 'string')
        expect(excerpt).toContain(monthDob.wording);
    expect(excerpt).not.toContain('expiration');
    expect(a.event).toEqual(c.event);
    for (const f of Object.keys(c.patient.facts))
        if (f !== 'dateOfBirth')
            expect(a.patient.facts[f as keyof typeof c.patient.facts]).toEqual(c.patient.facts[f as keyof typeof c.patient.facts]);
    expect(a.products).toEqual(c.products);
    expect(a.relevantTests).toEqual(c.relevantTests);
});

it('opening keeps explicitly stated age and partial DOB separate without selecting an A2 print choice',()=>{const text='Fictional patient DOB-231 is 57 years old. '+monthDob.wording;const r=parseQuotedFixture({turn:'opening',input:{id:'dob-opening',type:'narrative',text,recordedAt:'2026-10-17T00:00:00Z'},output:{products:[],proposals:[{proposalReference:'age',groupReference:'patient',intent:'fact',target:{entity:'patient',field:'ageYears'},value:{kind:'known',value:57},evidenceQuote:text},{proposalReference:'dob',groupReference:'patient',intent:'fact',target:{entity:'patient',field:'dateOfBirth'},value:{kind:'known',value:monthDob},evidenceQuote:monthDob.wording}]}},(k,r)=>`${k}-${r}`);expect(r.unrepresented).toEqual([]);expect(r.proposals.map(p=>p.target.field)).toEqual(['ageYears','dateOfBirth']);expect(r.proposals[0].value).toEqual({kind:'known',value:57});expect(r.proposals[1].value).toEqual({kind:'known',value:monthDob});});
