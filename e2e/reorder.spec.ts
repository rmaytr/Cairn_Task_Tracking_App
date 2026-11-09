import { expect, test, type Page } from '@playwright/test'
import { loadSample, taskButton, toast } from './helpers'

const classesTitles = (page: Page) => page.locator('.list__group').first().locator('.trow__title').allTextContents()

test.describe('reorder', () => {
  test('Alt+Down switches to My order, keeps focus, and survives a reload', async ({ page }) => {
    await loadSample(page)
    await page.goto('/#tasks')
    const [first, second] = await classesTitles(page)
    await taskButton(page, first!).focus()
    await page.keyboard.press('Alt+ArrowDown')

    await expect(toast(page)).toContainText('Switched to My order')
    await expect(page.locator('.tasks__sort select')).toHaveValue('manual')
    expect((await classesTitles(page)).slice(0, 2)).toEqual([second, first])
    await expect(taskButton(page, first!)).toBeFocused()

    await page.reload()
    await expect(page.locator('.tasks__sort select')).toHaveValue('manual')
    expect((await classesTitles(page)).slice(0, 2)).toEqual([second, first])
  })

  test('dragging by the grip reorders a group', async ({ page }) => {
    await loadSample(page)
    await page.goto('/#tasks')
    const [first, second, third] = await classesTitles(page)
    const row = page.locator('.list__group').first().locator('.trow').first()
    await row.hover()
    const grip = row.locator('.trow__grip')
    const box = (await grip.boundingBox())!
    const target = (await page.locator('.list__group').first().locator('.trow').nth(2).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, target.y + target.height * 0.8, { steps: 12 })
    await expect(page.locator('.drop-gap')).toHaveCount(1)
    await page.mouse.up()

    await expect.poll(() => classesTitles(page)).toEqual([second, third, first])
    await expect(page.locator('.tasks__sort select')).toHaveValue('manual')
  })

  test('Escape cancels a drag', async ({ page }) => {
    await loadSample(page)
    await page.goto('/#tasks')
    const before = await classesTitles(page)
    const row = page.locator('.list__group').first().locator('.trow').first()
    await row.hover()
    const box = (await row.locator('.trow__grip').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 140, { steps: 10 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect.poll(() => classesTitles(page)).toEqual(before)
    await expect(page.locator('.tasks__sort select')).toHaveValue('smart')
  })
})
