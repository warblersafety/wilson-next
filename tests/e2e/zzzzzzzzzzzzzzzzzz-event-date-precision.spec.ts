import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { eventDateCase, eventDates, missingDeathDateCase } from '../fixtures/event-date-precision';
import { eventDateFields } from '../../src/domain/case/date-precision';
import { browserStateVersion, journeyResponse } from '../../src/server/case/browser-state';
import { InMemoryCaseRepository } from '../../src/server/case/repository';
import { performJourneyAction } from '../../src/server/journey/service';
import { parseQuotedFixture } from '../fixtures/source-references';
import { goTo, seedStoredState, storedState, serverAction, savePdf, directAnswers } from './draft4-helpers';
const narrative = 'topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]';
const onset = 'topmostSubform[0].Page1[0].SecA_Patient[0].EventDate[0]';
const death = 'topmostSubform[0].Page1[0].SecA_Patient[0].DeathDate[0]';
const saved = async (p: Page) => expect(p.getByRole('region', { name: 'Browser saving' }).getByRole('status')).toHaveText('Saved in this browser');
async function seed(page: Page, c = eventDateCase()) {
    let unexpected = 0;
    await page.route('**/api/case', async (r) => {
        const b = r.request().method() === 'POST' ? r.request().postDataJSON() : undefined;
        if (r.request().method() !== 'POST' || b?.operation === 'resume' || ['set-fact', 'review-update-group', 'answer-death-date'].includes(b?.action?.action))
            await r.continue();
        else {
            unexpected++;
            await r.abort();
        }
    });
    await page.goto('/');
    await seedStoredState(page, { version: browserStateVersion, stage: 'output', case: c, unrepresented: [] });
    await page.reload();
    await saved(page);
    return () => expect(unexpected).toBe(0);
}
async function edit(page: Page, field: string) {
    await goTo(page, 'Review details');
    const card = page.locator('#case-card-event');
    let row = card.locator(`[data-field="${field}"]`);
    if (!await row.count())
        await card.getByRole('button', { name: /^Show more fields/ }).click();
    await row.getByRole('button', { name: /^(Add|Change)$/ }).click();
    return row;
}
async function pdf(page: Page, path: string) {
    await (await savePdf(page)).saveAs(path);
    return JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON ?? 'python3', ['tools/pdf/independent_readback.py', path, '--named', '--page-text'])).stdout);
}
test('event dates preserve exact wording through conversational review, resume, correction, Unknown and conditional death export', async ({ page }, info) => {
    const c = eventDateCase(), noModel = await seed(page, c);
    await page.route('**/api/case', async (r) => {
        const b = r.request().postDataJSON();
        if (b?.action?.action !== 'submit-update')
            return r.fallback();
        const repo = new InMemoryCaseRepository({ initialCase: b.state.case });
        const s = await performJourneyAction(repo, b.state.case.id, b.action, { propose: async (_turn, text) => ({ envelope: parseQuotedFixture({ turn: 'correction', input: { id: 'event-date-input', type: 'correction', text, recordedAt: '2026-10-16T00:00:00Z' }, output: { products: [], proposals: eventDateFields.map(field => ({ proposalReference: field, groupReference: field, intent: 'correction', target: { entity: 'event', field }, value: { kind: 'known', value: eventDates[field], qualifier: 'Exact day unavailable' }, evidenceQuote: eventDates[field].wording })) } }, (k, r) => `${k}-${r}`) }) });
        await r.fulfill({ json: await journeyResponse(repo, s) });
    });
    await goTo(page, 'Review details');
    await page.getByLabel('Clinical update', { exact: true }).fill(Object.values(eventDates).map(d => d.wording + '. Exact day unavailable.').join(' '));
    await serverAction(page, () => page.getByRole('button', { name: 'Prepare changes for review', exact: true }).click());
    for (const field of eventDateFields)
        expect((await storedState(page)).case.event.facts[field].resolvedValue).toEqual(c.event.facts[field].resolvedValue);
    for (const field of eventDateFields)
        await serverAction(page, () => page.getByRole('button', { name: 'Accept these changes', exact: true }).first().click());
    await saved(page);
    await page.reload();
    await saved(page);
    const before = (await storedState(page)).case;
    expect(before.patient).toEqual(c.patient);
    expect(before.products).toEqual(c.products);
    expect(before.relevantTests).toEqual(c.relevantTests);
    for (const field of Object.keys(c.event.facts))
        if (!eventDateFields.includes(field as typeof eventDateFields[number]))
            expect(before.event.facts[field as keyof typeof c.event.facts]).toEqual(c.event.facts[field as keyof typeof c.event.facts]);
    await writeFile(info.outputPath('event-partial-state.json'), JSON.stringify(await storedState(page)));
    let x = await pdf(page, info.outputPath('event-partial-dates.pdf'));
    expect(x.pageCount).toBe(9);
    expect(x.namedFields[onset]).toBe('B5 wording');
    expect(x.namedFields[death]).toBe('B5 wording');
    for (const d of Object.values(eventDates))
        expect(x.namedFields[narrative]).toContain(d.wording);
    let row = await edit(page, 'onsetDate');
    await row.getByLabel('Onset precision', { exact: true }).selectOption('year');
    await row.getByLabel('Onset year', { exact: true }).fill('2027');
    await row.getByLabel('Exact supplied onset wording', { exact: true }).fill('Event began during 2027');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    x = await pdf(page, info.outputPath('event-partial-corrected.pdf'));
    expect(x.namedFields[narrative]).toContain('Event began during 2027');
    expect(x.namedFields[narrative]).not.toContain(eventDates.onsetDate.wording);
    row = await edit(page, 'onsetDate');
    await row.getByLabel('Onset status', { exact: true }).selectOption('unknown');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    x = await pdf(page, info.outputPath('event-partial-unknown.pdf'));
    expect(x.namedFields[onset] ?? '').toBe('');
    expect(x.namedFields[narrative]).not.toContain('Event began during 2027');
    row = await edit(page, 'death');
    await row.getByLabel('New Death', { exact: true }).selectOption('false');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    x = await pdf(page, info.outputPath('event-death-not-selected.pdf'));
    expect(x.namedFields[death] ?? '').toBe('');
    expect(x.namedFields[narrative]).not.toContain(eventDates.deathDate.wording);
    expect((await storedState(page)).case.event.facts.deathDate).toEqual(before.event.facts.deathDate);
    expect(x.namedFields[narrative]).toContain(eventDates.dischargeDate.wording);
    noModel();
});
test('death follow-up saves an invalid partial draft and accepts only explicit corrected precision without other clinical inference', async ({ page }, info) => {
    const c = missingDeathDateCase(), noModel = await seed(page, c);
    let row = await edit(page,'deathDate');
    await row.getByLabel('Date of death precision', { exact: true }).selectOption('month');
    await row.getByLabel('Date of death year', { exact: true }).fill('2029');
    await row.getByLabel('Date of death month', { exact: true }).fill('13');
    await row.getByLabel('Exact supplied date of death wording', { exact: true }).fill('Death reported in March 2029');
    await expect(row.getByRole('button', { name: /^(Add fact|Apply correction)$/ })).toBeDisabled();
    await saved(page);
    await page.reload();
    await saved(page);
    await goTo(page,'Review details');row=page.locator('#case-card-event [data-field="deathDate"]');
    await expect(row.getByLabel('Date of death month', { exact: true })).toHaveValue('13');
    expect((await storedState(page)).case).toEqual(c);
    await row.getByLabel('Date of death month', { exact: true }).fill('03');
    await serverAction(page, () => row.getByRole('button', { name: /^(Add fact|Apply correction)$/ }).click());
    const after = (await storedState(page)).case;
    expect(after.event.facts.deathDate.resolvedValue?.value).toMatchObject({ kind: 'known', value: { precision: 'month', year: '2029', month: '03', wording: 'Death reported in March 2029' } });
    for (const field of Object.keys(c.event.facts))
        if (field !== 'deathDate')
            expect(after.event.facts[field as keyof typeof c.event.facts]).toEqual(c.event.facts[field as keyof typeof c.event.facts]);
    expect(after.patient).toEqual(c.patient);
    expect(after.products).toEqual(c.products);
    expect(after.relevantTests).toEqual(c.relevantTests);
    await page.screenshot({ path: info.outputPath('event-date-draft-completed.png'), fullPage: true });
    noModel();
});
