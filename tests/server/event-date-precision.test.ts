import { expect, it } from 'vitest';
import { parseQuotedFixture } from '../fixtures/source-references';
import { eventDateFields } from '../../src/domain/case/date-precision';
import { eventDates, missingDeathDateCase } from '../fixtures/event-date-precision';
import { knownValueMismatch } from '../../src/domain/case/value-contract';
import { InMemoryCaseRepository } from '../../src/server/case/repository';
import { getJourneySnapshot, performJourneyAction } from '../../src/server/journey/service';
import { journeyActionSchema } from '../../src/server/journey/action-contract';
it.each(eventDateFields)('grounds %s exact supplied precision without clinical inference; fabricated wording/year quarantines', field => {
    for (const value of [eventDates[field], { precision: 'year', year: '2031', wording: 'Explicit date during 2031' }, { ...eventDates[field], wording: 'Invented date wording' }, { ...eventDates[field], wording: 'Year not stated' }]) {
        const text = 'Fictional symptom; ' + (value.wording === 'Invented date wording' ? eventDates[field].wording : value.wording);
        const r = parseQuotedFixture({ turn: 'opening', input: { id: 'event-date-input', type: 'narrative', text, recordedAt: '2026-10-16T00:00:00Z' }, output: { products: [], proposals: [{ proposalReference: 'symptom', groupReference: 'event-date', intent: 'fact', target: { entity: 'event', field: 'symptoms' }, value: { kind: 'known', value: ['Fictional symptom'] }, evidenceQuote: text }, { proposalReference: 'date', groupReference: 'event-date', intent: 'fact', target: { entity: 'event', field }, value: { kind: 'known', value, qualifier: 'Date uncertain' }, evidenceQuote: text }] } }, (k, r) => `${k}-${r}`);
        if (value.wording === 'Invented date wording' || value.wording === 'Year not stated')
            expect(r.unrepresented).toContainEqual(expect.objectContaining({ field, reason: 'evidence-not-found' }));
        else {
            expect(r.unrepresented).toEqual([]);
            expect(r.proposals.map(p => p.target.field)).toEqual(['symptoms', field]);
            expect(r.proposals[1].value).toEqual({ kind: 'known', value, qualifier: 'Date uncertain' });
        }
    }
});
it('rejects malformed partials and keeps report/DOB contracts unchanged', () => {
    for (const field of eventDateFields)
        for (const value of [{ ...eventDates.onsetDate, month: '13' }, { ...eventDates.onsetDate, year: '0000' }, { ...eventDates.onsetDate, wording: '' }, { ...eventDates.onsetDate, day: '01' }, '2028-01', '2028-02-30'])
            expect(knownValueMismatch({ entity: 'event', entityId: 'event', field }, { kind: 'known', value })).toBeTruthy();
    for (const field of ['reportDate'] as const)
        expect(knownValueMismatch({ entity: 'event', entityId: 'event', field }, { kind: 'known', value: eventDates.onsetDate })).toBeTruthy();
    expect(knownValueMismatch({ entity: 'patient', entityId: 'patient', field: 'dateOfBirth' }, { kind: 'known', value: eventDates.onsetDate })).toBeTruthy();
});
it('existing death follow-up records only supplied date with readable source; no model call or outcome inference', async () => {
    const c = missingDeathDateCase(), repo = new InMemoryCaseRepository({ initialCase: c });
    expect((await getJourneySnapshot(repo, c.id)).clarification?.kind).toBe('death-date');
    const action = { action: 'answer-death-date' as const, value: { kind: 'known' as const, value: eventDates.deathDate, qualifier: 'Exact day unavailable' } };
    expect(journeyActionSchema.safeParse(action).success).toBe(true);
    expect(journeyActionSchema.safeParse({ action: 'answer-death-date', value: { kind: 'explicitly-absent' } }).success).toBe(true);
    await performJourneyAction(repo, c.id, action, { propose: async () => {
            throw new Error('Unexpected model call');
        } });
    const after = (await repo.load(c.id))!;
    expect(after.event.facts.deathDate.resolvedValue?.value).toEqual(action.value);
    expect(after.event.facts.death).toEqual(c.event.facts.death);
    expect(after.event.facts.hospitalized).toEqual(c.event.facts.hospitalized);
    expect(after.patient).toEqual(c.patient);
    expect(after.products).toEqual(c.products);
    expect(after.relevantTests).toEqual(c.relevantTests);
    const text = after.event.facts.deathDate.sourceIds.map(id => after.sources.find(s => s.id === id)!.excerpt).join('\n');
    expect(text).toContain(eventDates.deathDate.wording);
    expect(text).toContain('Exact day unavailable');
    expect(text).not.toContain('expiration');
});
it('complete death follow-up preserves qualifier in readable source and current PDF context without inferring other facts', async () => {
    const c = missingDeathDateCase(), repo = new InMemoryCaseRepository({ initialCase: c });
    await performJourneyAction(repo, c.id, { action: 'answer-death-date', value: { kind: 'known', value: '2029-03-12', qualifier: 'Date estimated by fictional reporter' } }, { propose: async () => {
            throw new Error('Unexpected model call');
        } });
    const after = (await repo.load(c.id))!, fact = after.event.facts.deathDate;
    expect(fact.resolvedValue?.value).toEqual({ kind: 'known', value: '2029-03-12', qualifier: 'Date estimated by fictional reporter' });
    expect(fact.resolvedValue!.sourceIds.map(id => after.sources.find(s => s.id === id)!.excerpt).join(' ')).toContain('Date estimated by fictional reporter');
    const snapshot = await getJourneySnapshot(repo, c.id);
    expect(snapshot.projection.sections.B.deathDate).toBe('2029-03-12');
    expect(snapshot.projection.sections.B.eventDescription).toContain('B2 death date context: Date estimated by fictional reporter');
    expect(after.event.facts.death).toEqual(c.event.facts.death);
    expect(after.patient).toEqual(c.patient);
    expect(after.products).toEqual(c.products);
});
