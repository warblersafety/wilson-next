import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { dobPrecisionCase, monthDob } from '../fixtures/dob-precision';
import { browserStateVersion, journeyResponse } from '../../src/server/case/browser-state';
import { InMemoryCaseRepository } from '../../src/server/case/repository';
import { performJourneyAction } from '../../src/server/journey/service';
import { parseQuotedFixture } from '../fixtures/source-references';
import { goTo, seedStoredState, storedState, serverAction, savePdf } from './draft4-helpers';
const comments = 'topmostSubform[0].Page3[0].AdditionalComments[0]', date = 'topmostSubform[0].Page1[0].SecA_Patient[0].DateBirth[0]', label = 'Date of birth';
const saved = async (p: Page) => expect(p.getByRole('region', { name: 'Browser saving' }).getByRole('status')).toHaveText('Saved in this browser');
async function seed(page: Page) {
    let unexpected = 0;
    await page.route('**/api/case', async (r) => {
        const b = r.request().method() === 'POST' ? r.request().postDataJSON() : undefined;
        if (r.request().method() !== 'POST' || b?.operation === 'resume' || ['set-fact', 'review-update-group'].includes(b?.action?.action))
            await r.continue();
        else {
            unexpected++;
            await r.abort();
        }
    });
    await page.goto('/');
    await seedStoredState(page, { version: browserStateVersion, stage: 'output', case: dobPrecisionCase(), unrepresented: [] });
    await page.reload();
    await saved(page);
    return () => expect(unexpected).toBe(0);
}
async function edit(page: Page, field = 'dateOfBirth') {
    await goTo(page, 'Review details');
    const card = page.locator('#case-card-patient');
    let row = card.locator(`[data-field="${field}"]`);
    if (!await row.count())
        await card.getByRole('button', { name: /^Show more fields/ }).click();
    await row.getByRole('button', { name: 'Change', exact: true }).click();
    return row;
}
async function pdf(page: Page, path: string) {
    await (await savePdf(page)).saveAs(path);
    return JSON.parse((await promisify(execFile)(process.env.PYPDF_PYTHON ?? 'python3', ['tools/pdf/independent_readback.py', path, '--named', '--page-text'])).stdout);
}
test('A2 conversational partial DOB stays pending until review, resumes exactly and corrects/clears without stale PDF wording or derived age', async ({ page }, info) => {
    const c = dobPrecisionCase(), noModel = await seed(page);
    await page.route('**/api/case', async (r) => {
        const b = r.request().postDataJSON();
        if (b?.action?.action !== 'submit-update')
            return r.fallback();
        const repo = new InMemoryCaseRepository({ initialCase: b.state.case });
        const snap = await performJourneyAction(repo, b.state.case.id, b.action, { propose: async (_turn, text) => ({ envelope: parseQuotedFixture({ turn: 'correction', input: { id: 'dob-input', type: 'correction', text, recordedAt: '2026-10-17T00:00:00Z' }, output: { products: [], proposals: [{ proposalReference: 'dob-date', groupReference: 'dob-date', intent: 'correction', target: { entity: 'patient', field: 'dateOfBirth' }, value: { kind: 'known', value: monthDob, qualifier: 'Exact birth day unavailable' }, evidenceQuote: monthDob.wording }] } }, (k, r) => `${k}-${r}`) }) });
        await r.fulfill({ json: await journeyResponse(repo, snap) });
    });
    await goTo(page, 'Review details');
    await page.getByLabel('Clinical update', { exact: true }).fill(monthDob.wording + '. Exact birth day unavailable.');
    await serverAction(page, () => page.getByRole('button', { name: 'Prepare changes for review', exact: true }).click());
    expect((await storedState(page)).case.patient.facts.dateOfBirth.resolvedValue).toEqual(c.patient.facts.dateOfBirth.resolvedValue);
    await serverAction(page, () => page.getByRole('button', { name: 'Accept these changes', exact: true }).click());
    await saved(page);
    await page.reload();
    await saved(page);
    const before = (await storedState(page)).case;
    expect(before.event).toEqual(c.event);
    expect(before.products).toEqual(c.products);
    expect(before.relevantTests).toEqual(c.relevantTests);
    for (const f of Object.keys(c.patient.facts))
        if (f !== 'dateOfBirth')
            expect(before.patient.facts[f as keyof typeof c.patient.facts]).toEqual(c.patient.facts[f as keyof typeof c.patient.facts]);
    await writeFile(info.outputPath('dob-partial-state.json'), JSON.stringify(await storedState(page)));
    let x = await pdf(page, info.outputPath('dob-partial-dates.pdf'));
    expect(x.pageCount).toBe(8);
    expect(x.namedFields[date]).toBe('B6 comments');
    expect(x.namedFields[comments]).toContain(monthDob.wording);
    let row = await edit(page);
    await row.getByLabel(label + ' precision', { exact: true }).selectOption('year');
    await row.getByLabel(label + ' year', { exact: true }).fill('1970');
    await row.getByLabel('Exact supplied date of birth wording', { exact: true }).fill('Birth year supplied as 1970');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    x = await pdf(page, info.outputPath('dob-partial-corrected.pdf'));
    expect(x.namedFields[comments]).toContain('Birth year supplied as 1970');
    expect(x.namedFields[comments]).not.toContain(monthDob.wording);
    row = await edit(page);
    await row.getByLabel(label + ' status', { exact: true }).selectOption('unknown');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    await goTo(page,'Review & save');
    await expect(page.getByRole('link',{name:'Save PDF',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Generate updated PDF',exact:true})).toBeDisabled();
    let choice = await edit(page, 'a2Value');
    await choice.getByLabel('New A2 value to print', { exact: true }).selectOption('age');
    await serverAction(page, () => choice.getByRole('button', { name: 'Apply correction', exact: true }).click());
    x = await pdf(page, info.outputPath('dob-age-after-unknown.pdf'));
    expect(x.namedFields[date] ?? '').toBe('');
    expect(x.namedFields[comments] ?? '').not.toContain('Birth year supplied as 1970');
    noModel();
});
test('partial DOB draft survives reload; A2 choice suppresses/restores exact DOB without changing retained age or other facts', async ({ page }, info) => {
    const c = dobPrecisionCase(), noModel = await seed(page);
    let row = await edit(page);
    await row.getByLabel(label + ' precision', { exact: true }).selectOption('month');
    await row.getByLabel(label + ' year', { exact: true }).fill('1969');
    await row.getByLabel(label + ' month', { exact: true }).fill('13');
    await row.getByLabel('Exact supplied date of birth wording', { exact: true }).fill(monthDob.wording);
    await expect(row.getByRole('button', { name: 'Apply correction', exact: true })).toBeDisabled();
    await saved(page);
    await page.reload();
    await saved(page);
    await goTo(page, 'Review details');
    row = page.locator('#case-card-patient [data-field="dateOfBirth"]');
    if(!await row.count())await page.locator('#case-card-patient').getByRole('button',{name:/^Show more fields/}).click();
    await expect(row.getByLabel(label + ' month', { exact: true })).toHaveValue('13');
    expect((await storedState(page)).case).toEqual(c);
    await row.getByLabel(label + ' month', { exact: true }).fill('02');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    const held = (await storedState(page)).case;
    row = await edit(page, 'a2Value');
    await row.getByLabel('New A2 value to print', { exact: true }).selectOption('age');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    let x = await pdf(page, info.outputPath('dob-age-selected.pdf'));
    expect(x.namedFields[date] ?? '').toBe('');
    expect(x.namedFields[comments] ?? '').not.toContain(monthDob.wording);
    expect((await storedState(page)).case.patient.facts.dateOfBirth).toEqual(held.patient.facts.dateOfBirth);
    row = await edit(page);
    await row.getByLabel(label + ' precision', { exact: true }).selectOption('year');
    await row.getByLabel(label + ' year', { exact: true }).fill('1971');
    await row.getByLabel('Exact supplied date of birth wording', { exact: true }).fill('Birth year supplied as 1971');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    row = await edit(page, 'a2Value');
    await row.getByLabel('New A2 value to print', { exact: true }).selectOption('date-of-birth');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    x = await pdf(page, info.outputPath('dob-restored-current.pdf'));
    expect(x.namedFields[date]).toBe('B6 comments');
    expect(x.namedFields[comments]).toContain('Birth year supplied as 1971');
    expect(x.namedFields[comments]).not.toContain(monthDob.wording);
    const after = (await storedState(page)).case;
    expect(after.patient.facts.ageYears).toEqual(c.patient.facts.ageYears);
    expect(after.event).toEqual(c.event);
    expect(after.products).toEqual(c.products);
    expect(after.relevantTests).toEqual(c.relevantTests);
    await page.screenshot({ path: info.outputPath('dob-draft-completed.png'), fullPage: true });
    noModel();
});
