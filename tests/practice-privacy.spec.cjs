const {test, expect} = require('@playwright/test');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const url = pathToFileURL(path.resolve(__dirname, '../practice.html')).href;
const key = 'connectlab-practice-v1';
const record = {
  1: 'PRIVATE_IDEA', __title: 'PRIVATE_TITLE',
  __peers: [{name: 'PRIVATE_PEER', good: 'PRIVATE_PRAISE', idea: 'PRIVATE_ADVICE'}, {}, {}],
  __refl: {r1: 'PRIVATE_REFLECTION'}, __stars: 5,
  __opened: true, __submitted: true, __reflCopied: true, __checks: {c1: true},
};
async function seed(page, step = 1) {
  await page.goto(url);
  await page.evaluate(({key, record}) => {
    localStorage.setItem(key, JSON.stringify(record));
    localStorage.setItem('unrelated-setting', 'keep');
  }, {key, record});
  await page.goto(url + '#step' + step);
  await page.reload();
  await expect(page.locator('#workTitle')).toHaveValue(record.__title);
  await expect(page.locator('#r1')).toHaveValue(record.__refl.r1);
}
for (const [step, button] of [[1, '#clearBtn'], [6, '#clearFinalBtn']]) {
  test(`step ${step} clears all records, derived UI and old handlers`, async ({page}) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await seed(page, step);
    page.once('dialog', d => d.accept());
    await Promise.all([page.waitForEvent('load'), page.locator(button).click()]);
    await page.reload();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('unrelated-setting'))).toBe('keep');
    expect(await page.locator('input:not([type=checkbox]), textarea').evaluateAll(els => els.map(e => e.value).join(' '))).not.toContain('PRIVATE_');
    expect(await page.locator('body').textContent()).not.toContain('PRIVATE_');
    await expect(page.locator('input[type=checkbox]:checked')).toHaveCount(0);
    await expect(page.locator('#stars .on')).toHaveCount(0);
    await page.goto(url + '#step5');
    await page.reload();
    await page.locator('#peers [data-k=name]').first().fill('NEW_WORK');
    const stored = await page.evaluate(key => localStorage.getItem(key), key);
    expect(stored).toContain('NEW_WORK');
    expect(stored).not.toContain('PRIVATE_');
    expect(errors).toEqual([]);
  });
}
test('cancelling deletion preserves records', async ({page}) => {
  await seed(page);
  const before = await page.evaluate(key => localStorage.getItem(key), key);
  page.once('dialog', d => d.dismiss());
  await page.locator('#clearBtn').click();
  await page.reload();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before);
  await expect(page.locator('#workTitle')).toHaveValue(record.__title);
});
test('storage deletion failure is reported without claiming success', async ({page}) => {
  await seed(page);
  await page.evaluate(() => { Storage.prototype.removeItem = () => { throw new Error('blocked'); }; });
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  await page.locator('#clearBtn').click();
  expect(dialogs).toHaveLength(2);
  expect(dialogs[1]).toContain('기록을 지우지 못했어요');
  await expect(page.locator('#workTitle')).toHaveValue(record.__title);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toContain('PRIVATE_TITLE');
});
