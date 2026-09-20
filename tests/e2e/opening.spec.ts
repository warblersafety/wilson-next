import { expect, test, type Page } from "@playwright/test";

async function storedCase(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("wilson-journey-state-v2")!).case);
}

test("a blank case has no review claim, and New case protects an unsubmitted draft", async ({ page }) => {
  await page.goto("/");
  const account = page.getByLabel("Clinical account", { exact: true });
  const newCase = page.getByRole("button", { name: "New case", exact: true });
  await expect(account).toBeVisible();
  const blank = await storedCase(page);
  expect(blank.revision).toBe(0);
  await expect(page.getByRole("heading", { name: "Case summary", exact: true })).toHaveCount(0);
  await expect(page.getByText("Reviewed", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review Wilson’s understanding" })).toBeDisabled();

  let dialogs = 0;
  page.on("dialog", async (dialog) => { dialogs++; await dialog.dismiss(); });
  await newCase.click();
  await expect.poll(async () => (await storedCase(page)).id).not.toBe(blank.id);
  expect(dialogs).toBe(0);
  await expect(page.getByRole("status")).toHaveText("New case started");
  await expect(account).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("", { timeout: 7_000 });

  const draft = "Fictional draft: no rash. Still checking these details.";
  await account.fill(draft);
  const before = await storedCase(page);
  await newCase.click();
  expect(dialogs).toBe(1);
  await expect(account).toHaveValue(draft);
  expect(await storedCase(page)).toEqual(before);

  page.removeAllListeners("dialog");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("unfinished text will be lost");
    await dialog.accept();
  });
  await newCase.click();
  await expect(account).toHaveValue("");
  await expect.poll(async () => (await storedCase(page)).id).not.toBe(before.id);
  expect((await storedCase(page)).revision).toBe(0);
  await expect(account).toBeFocused();
  await expect(page.getByRole("heading", { name: "Case summary", exact: true })).toHaveCount(0);

  await page.reload();
  await expect(account).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("");
  await expect(page.getByText("Reviewed", { exact: true })).toHaveCount(0);
});
