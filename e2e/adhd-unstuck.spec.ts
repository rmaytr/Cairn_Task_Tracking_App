import { expect, test } from '@playwright/test'
import { expectPersisted, loadSample, taskButton } from './helpers'

test.describe('ADHD toolkit: stuck, treats, move', () => {
  test('"It\'s too big" adds a tiny step to the task', async ({ page }) => {
    await loadSample(page)
    await page.goto('/#adhd/unstuck')
    const title = (await page.locator('.stuck__pick').textContent())!
    await page.getByRole('button', { name: 'Use this one' }).click()
    await expect(page.getByRole('heading', { name: 'What’s in the way?' })).toBeFocused()
    await page.getByRole('button', { name: 'It’s too big' }).click()
    const opener = page.locator('.stuck__move .stuck__choice').first()
    const step = (await opener.textContent())!.trim()
    await opener.click()
    await expect(page.getByRole('status').filter({ hasText: 'Added to' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Focus room/ })).toBeVisible()

    await page.goto('/#tasks')
    await taskButton(page, title).first().click()
    await expect.poll(() => page.locator('[aria-label="Task details"] input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toContain(step)
  })

  test('"I don\'t know where to start" saves an if-then plan', async ({ page }) => {
    await loadSample(page)
    await page.goto('/#adhd/unstuck')
    await page.getByRole('button', { name: 'Use this one' }).click()
    await page.getByRole('button', { name: 'I don’t know where to start' }).click()
    await page.getByRole('button', { name: 'after breakfast' }).click()
    await page.getByLabel('I will').fill('open the doc')
    await page.getByRole('button', { name: 'Save my plan' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Saved: When after breakfast, I will open the doc.' })).toBeVisible()

    await page.goto('/#home')
    await expect(page.getByText('You planned: When after breakfast, I will open the doc.')).toBeVisible()
  })

  test('reward menu add survives a reload', async ({ page }) => {
    await loadSample(page)
    await page.goto('/#adhd/treats')
    await page.getByLabel('New treat').fill('Pet a cat')
    await page.getByRole('button', { name: /^Add$/ }).click()
    await expect(page.getByLabel('Treat 8')).toHaveValue('Pet a cat')
    await expectPersisted(page, 'Pet a cat')
    await page.reload()
    await expect(page.getByLabel('Treat 8')).toHaveValue('Pet a cat')
  })

  test('move break can be skipped to the end', async ({ page }) => {
    await loadSample(page)
    await page.goto('/#adhd/move')
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /Skip move/ }).click()
    await page.getByRole('button', { name: 'Back to it' }).click()
    await expect(page).toHaveURL(/#adhd$/)
  })
})
