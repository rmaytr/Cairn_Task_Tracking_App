import { expect, test } from '@playwright/test'
import { sideButton, startEmpty } from './helpers'

test.describe('appearance', () => {
  test('a theme card applies the theme, arrow keys move between cards, and it survives a reload', async ({ page }) => {
    await startEmpty(page)
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', /^(stone|night)$/)

    await sideButton(page, 'Settings').click()
    const dialog = page.getByRole('dialog', { name: 'Settings' })
    const themes = dialog.getByRole('group', { name: 'Theme' })
    await expect(themes.getByRole('radio', { name: 'Match system' })).toBeChecked()

    await themes.getByRole('radio', { name: 'Notes' }).check()
    await expect(html).toHaveAttribute('data-theme', 'notes')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f4efe4')

    await page.keyboard.press('ArrowRight')
    await expect(themes.getByRole('radio', { name: 'Moss' })).toBeChecked()
    await expect(html).toHaveAttribute('data-theme', 'moss')

    await dialog.getByRole('button', { name: 'Larger' }).click()
    await expect(html).toHaveAttribute('data-text-size', 'larger')

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'moss')
    await expect(html).toHaveAttribute('data-text-size', 'larger')
  })
})
