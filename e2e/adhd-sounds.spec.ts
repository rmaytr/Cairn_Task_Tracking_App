import { expect, test, type Page } from '@playwright/test'
import { expectPersisted, startEmpty } from './helpers'

async function openSounds(page: Page): Promise<void> {
  await startEmpty(page)
  await page.goto('/#adhd/sounds')
  await expect(page.getByRole('heading', { level: 1, name: 'Focus sounds' })).toBeVisible()
}

test.describe('focus sounds', () => {
  test('pick a sound, play it, set volume and a timer; the choice survives a reload', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await openSounds(page)
    const kinds = page.getByRole('group', { name: 'Sound' })
    await kinds.getByRole('radio', { name: /Brown noise/ }).check({ force: true }) // native radio, visually hidden in its card
    await expect(page.getByRole('button', { name: 'Stop sound' })).toHaveCount(0) // picking never autoplays

    await page.getByRole('button', { name: 'Play brown noise' }).click()
    await expect(page.getByRole('button', { name: 'Stop sound' })).toBeVisible()
    await expect(page.getByText('Playing brown noise.')).toBeVisible()

    await kinds.getByRole('radio', { name: /Brown noise/ }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(kinds.getByRole('radio', { name: /Rain/ })).toBeChecked()
    await expect(page.getByText('Playing rain.')).toBeVisible()

    const volume = page.getByRole('slider', { name: 'Volume' })
    await volume.focus()
    await page.keyboard.press('ArrowRight')
    await expect(volume).toHaveAttribute('aria-valuetext', '40 percent')

    await page.getByRole('group', { name: 'Stop after' }).getByRole('radio', { name: '15 min' }).check({ force: true })
    await expect(page.getByText(/Stops at/)).toBeVisible()

    // The sound keeps playing on other views.
    await page.goto('/#today')
    await page.goto('/#adhd/sounds')
    await expect(page.getByRole('button', { name: 'Stop sound' })).toBeVisible()
    await page.getByRole('button', { name: 'Stop sound' }).click()
    await expect(page.getByText('Sound off.')).toBeVisible()

    await expectPersisted(page, '"sound":{"kind":"rain","volume":0.4}')
    await page.reload()
    await expect(page.getByRole('group', { name: 'Sound' }).getByRole('radio', { name: /Rain/ })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Play rain' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuetext', '40 percent')
    expect(errors).toEqual([])
  })

  test('shows the evidence and the personal test, and fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await openSounds(page)
    await expect(page.getByRole('heading', { name: 'What the research says' })).toBeVisible()
    await expect(page.getByText(/Rate a few Focus room blocks/)).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: 'Open the Focus room' }).click()
    await expect(page).toHaveURL(/#adhd\/room$/)
  })
})
