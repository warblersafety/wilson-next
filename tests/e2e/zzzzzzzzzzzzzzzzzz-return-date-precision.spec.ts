import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { returnDateCase, monthReturnDate } from '../fixtures/return-date-precision';
import { browserStateVersion, journeyResponse } from '../../src/server/case/browser-state';
import { InMemoryCaseRepository } from '../../src/server/case/repository';
import { performJourneyAction } from '../../src/server/journey/service';
import { parseQuotedFixture } from '../fixtures/source-references';
import { goTo, seedStoredState, storedState, serverAction, savePdf } from './draft4-helpers';
const comments = 'topmostSubform[0].Page3[0].AdditionalComments[0]', date = 'topmostSubform[0].Page3[0].TestDataTable[0].ReturnDate[0]', label = 'Returned to manufacturer';
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
    await seedStoredState(page, { version: browserStateVersion, stage: 'output', case: returnDateCase(), unrepresented: [] });
    await page.reload();
    await saved(page);
    return () => expect(unexpected).toBe(0);
}
async function edit(page: Page, field = 'productReturnDate') {
    await goTo(page, 'Review details');
    const card = page.locator('#case-card-event');
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
test('C1 conversational partial return date stays pending until review, resumes exactly and corrects/clears without stale PDF wording', async ({ page }, info) => {
    const c = returnDateCase(), noModel = await seed(page);
    await page.route('**/api/case', async (r) => {
        const b = r.request().postDataJSON();
        if (b?.action?.action !== 'submit-update')
            return r.fallback();
        const repo = new InMemoryCaseRepository({ initialCase: b.state.case });
        const snap = await performJourneyAction(repo, b.state.case.id, b.action, { propose: async (_turn, text) => ({ envelope: parseQuotedFixture({ turn: 'correction', input: { id: 'return-input', type: 'correction', text, recordedAt: '2026-10-17T00:00:00Z' }, output: { products: [], proposals: [{ proposalReference: 'return-date', groupReference: 'return-date', intent: 'correction', target: { entity: 'event', field: 'productReturnDate' }, value: { kind: 'known', value: monthReturnDate, qualifier: 'Exact return day unavailable' }, evidenceQuote: monthReturnDate.wording }] } }, (k, r) => `${k}-${r}`) }) });
        await r.fulfill({ json: await journeyResponse(repo, snap) });
    });
    await goTo(page, 'Review details');
    await page.getByLabel('Clinical update', { exact: true }).fill(monthReturnDate.wording + '. Exact return day unavailable.');
    await serverAction(page, () => page.getByRole('button', { name: 'Prepare changes for review', exact: true }).click());
    expect((await storedState(page)).case.event.facts.productReturnDate.resolvedValue).toEqual(c.event.facts.productReturnDate.resolvedValue);
    await serverAction(page, () => page.getByRole('button', { name: 'Accept these changes', exact: true }).click());
    await saved(page);
    await page.reload();
    await saved(page);
    const before = (await storedState(page)).case;
    expect(before.patient).toEqual(c.patient);
    expect(before.products).toEqual(c.products);
    expect(before.relevantTests).toEqual(c.relevantTests);
    for (const f of Object.keys(c.event.facts))
        if (f !== 'productReturnDate')
            expect(before.event.facts[f as keyof typeof c.event.facts]).toEqual(c.event.facts[f as keyof typeof c.event.facts]);
    await writeFile(info.outputPath('return-partial-state.json'), JSON.stringify(await storedState(page)));
    let x = await pdf(page, info.outputPath('return-partial-dates.pdf'));
    expect(x.pageCount).toBe(8);
    expect(x.namedFields[date]).toBe('B6 comments');
    expect(x.namedFields[comments]).toContain(monthReturnDate.wording);
    let row = await edit(page);
    await row.getByLabel(label + ' precision', { exact: true }).selectOption('year');
    await row.getByLabel(label + ' year', { exact: true }).fill('2029');
    await row.getByLabel('Exact supplied returned to manufacturer wording', { exact: true }).fill('Return recorded during 2029');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    x = await pdf(page, info.outputPath('return-partial-corrected.pdf'));
    expect(x.namedFields[comments]).toContain('Return recorded during 2029');
    expect(x.namedFields[comments]).not.toContain(monthReturnDate.wording);
    row = await edit(page);
    await row.getByLabel(label + ' status', { exact: true }).selectOption('unknown');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    x = await pdf(page, info.outputPath('return-partial-unknown.pdf'));
    expect(x.namedFields[date] ?? '').toBe('');
    expect(x.namedFields[comments] ?? '').not.toContain('Return recorded during 2029');
    noModel();
});
test('invalid return precision draft survives reload; explicit valid correction and prerequisite change retain dates without inferring return', async ({ page }, info) => {
    const c = returnDateCase(), noModel = await seed(page);
    let row = await edit(page);
    await row.getByLabel(label + ' precision', { exact: true }).selectOption('month');
    await row.getByLabel(label + ' year', { exact: true }).fill('2028');
    await row.getByLabel(label + ' month', { exact: true }).fill('13');
    await row.getByLabel('Exact supplied returned to manufacturer wording', { exact: true }).fill(monthReturnDate.wording);
    await expect(row.getByRole('button', { name: 'Apply correction', exact: true })).toBeDisabled();
    await saved(page);
    await page.reload();
    await saved(page);
    await goTo(page, 'Review details');
    row = page.locator('#case-card-event [data-field="productReturnDate"]');
    await expect(row.getByLabel(label + ' month', { exact: true })).toHaveValue('13');
    expect((await storedState(page)).case).toEqual(c);
    await row.getByLabel(label + ' month', { exact: true }).fill('02');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    const held = (await storedState(page)).case;
    expect(held.event.facts.productAvailability).toEqual(c.event.facts.productAvailability);
    row = await edit(page, 'productAvailability');
    await row.getByLabel('New Product availability', { exact: true }).selectOption('available');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    let x = await pdf(page, info.outputPath('return-not-selected.pdf'));
    expect(x.namedFields[date] ?? '').toBe('');
    expect(x.namedFields[comments] ?? '').not.toContain(monthReturnDate.wording);
    expect((await storedState(page)).case.event.facts.productReturnDate).toEqual(held.event.facts.productReturnDate);
    row = await edit(page);
    await row.getByLabel(label + ' precision', { exact: true }).selectOption('year');
    await row.getByLabel(label + ' year', { exact: true }).fill('2030');
    await row.getByLabel('Exact supplied returned to manufacturer wording', { exact: true }).fill('Return recorded during 2030');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    row = await edit(page, 'productAvailability');
    await row.getByLabel('New Product availability', { exact: true }).selectOption('returned-to-manufacturer');
    await serverAction(page, () => row.getByRole('button', { name: 'Apply correction', exact: true }).click());
    x = await pdf(page, info.outputPath('return-restored-current.pdf'));
    expect(x.namedFields[date]).toBe('B6 comments');
    expect(x.namedFields[comments]).toContain('Return recorded during 2030');
    expect(x.namedFields[comments]).not.toContain(monthReturnDate.wording);
    const after = (await storedState(page)).case;
    expect(after.patient).toEqual(c.patient);
    expect(after.products).toEqual(c.products);
    expect(after.relevantTests).toEqual(c.relevantTests);
    await page.screenshot({ path: info.outputPath('return-date-draft-completed.png'), fullPage: true });
    noModel();
});
