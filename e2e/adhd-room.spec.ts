import { expect, test } from '@playwright/test'
import { expectPersisted, loadSample, taskButton } from './helpers'

const MIN = 60_000

test.describe('Focus room', () => {
  test('a guessed block with a parked thought and a rating shows up in Time sense after reload', async ({ page }) => {
    await loadSample(page)
    // Freeze the clock (timers still run) so three minutes can pass on demand.
    const t0 = Date.now()
    await page.clock.setFixedTime(t0)
    await page.goto('/#adhd/room')

    await expect(page.getByRole('heading', { name: 'How long do you think this will take?' })).toBeVisible()
    const title = (await page.locator('.room-task__title').textContent())!.trim()

    await page.getByRole('button', { name: '5 min', exact: true }).click()
    await page.getByRole('button', { name: 'Start 5 min' }).click()
    await expect(page.getByRole('timer')).toContainText('5:00')
    await expect(page.locator('.room-buddy__line')).toContainText('I’ll sit with you')

    const park = page.getByRole('textbox', { name: 'Park it' })
    await park.fill('Buy stamps')
    await park.press('Enter')
    await expect(park).toHaveValue('')
    await expect(page.getByRole('list', { name: 'Parked this block' })).toContainText('Buy stamps')

    await page.clock.setFixedTime(t0 + 3 * MIN)
    await expect(page.getByRole('timer')).toContainText('2:00')
    await page.getByRole('button', { name: 'Stop and wrap up' }).click()

    await expect(page.getByRole('heading', { name: `3 min on ${title}.` })).toBeVisible()
    await expect(page.getByText('You guessed 5, it took 3. Quicker than you thought; Cairn will remember.')).toBeVisible()
    await page.locator('.room-rate__opt', { hasText: 'Focused' }).click()
    await expect(page.getByRole('radio', { name: /Focused/ })).toBeChecked()
    await expectPersisted(page, '"rating":4')
    await expectPersisted(page, 'Buy stamps')

    await page.goto('/#tasks')
    await expect(taskButton(page, 'Buy stamps')).toBeVisible()

    await page.reload()
    await page.goto('/#adhd/time')
    await expect(page.getByText('Make 3 guesses first')).toBeVisible()
    await expect(page.getByText('1 of 3 so far.')).toBeVisible()
    await page.getByText('Show as a table').click()
    const row = page.getByRole('row').filter({ hasText: title })
    await expect(row).toContainText('5 min')
    await expect(row).toContainText('3 min')
  })

  test('the focus rating fits a 320px screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await loadSample(page)
    const t0 = Date.now()
    await page.clock.setFixedTime(t0)
    await page.goto('/#adhd/room')
    await page.getByRole('button', { name: '5 min', exact: true }).click()
    await page.getByRole('button', { name: 'Start 5 min' }).click()
    await page.clock.setFixedTime(t0 + 2 * MIN)
    await page.getByRole('button', { name: 'Stop and wrap up' }).click()

    const opts = page.locator('.room-rate__opt')
    await expect(opts).toHaveCount(5)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    for (const opt of await opts.all()) {
      const fits = await opt.evaluate((el) => el.scrollWidth <= el.clientWidth)
      expect(fits).toBe(true)
    }
  })
})
