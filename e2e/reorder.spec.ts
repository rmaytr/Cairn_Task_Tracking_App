import { expect, test, type Page } from '@playwright/test'
import { captureTask, expectPersisted, loadSample, sidebar, startEmpty, taskButton } from './helpers'

const classesTitles = (page: Page) => page.locator('.list__group').first().locator('.trow__title').allTextContents()
const areaNames = (page: Page) => sidebar(page).locator('.side__area-name').allTextContents()
const areaItem = (page: Page, n: number) => sidebar(page).locator('.side__area-item').nth(n)
const panel = (page: Page, heading: 'today-h' | 'week-h') => page.locator(`section[aria-labelledby="${heading}"]`)
const panelTitles = (page: Page, heading: 'today-h' | 'week-h') => panel(page, heading).locator('.trow__title').allTextContents()

/** Presses at the centre of `from`, moves (in steps, so the drag sees it) to `to`, and releases. */
async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await expect(page.locator('.drop-gap')).toHaveCount(1)
  await page.mouse.up()
}

/** Four tasks for today (one becomes Up next, three fill the Today panel) and two for this week. */
async function seedToday(page: Page): Promise<void> {
  await startEmpty(page)
  for (const title of ['Alpha @today', 'Bravo @today', 'Charlie @today', 'Delta @today', 'Echo @week', 'Foxtrot @week']) await captureTask(page, title)
  await expect(panel(page, 'today-h').locator('.trow')).toHaveCount(3)
  await expect(panel(page, 'week-h').locator('.trow')).toHaveCount(2)
}

const centre = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

test.describe('reorder', () => {
  test('Alt+Down switches to My order, keeps focus, and survives a reload', async ({ page }) => {
    await loadSample(page)
    await page.goto('/#tasks')
    const [first, second] = await classesTitles(page)
    await taskButton(page, first!).focus()
    await page.keyboard.press('Alt+ArrowDown')

    await expect(page.locator('.toast', { hasText: 'Switched to My order' })).toBeVisible()
    await expect(page.locator('.tasks__sort select')).toHaveValue('manual')
    expect((await classesTitles(page)).slice(0, 2)).toEqual([second, first])
    await expect(taskButton(page, first!)).toBeFocused()

    await expectPersisted(page, '"sort":"manual"')
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

  test('the row menu moves a task without dragging or shortcuts', async ({ page }) => {
    await loadSample(page)
    await page.goto('/#tasks')
    const [first, second] = await classesTitles(page)
    const row = page.locator('.list__group').first().locator('.trow').first()
    await row.locator('.trow__dots').click()
    await expect(page.getByRole('menuitem', { name: 'Move up' })).toHaveCount(0)
    await page.getByRole('menuitem', { name: 'Move down' }).click()
    await expect.poll(() => classesTitles(page).then((t) => t.slice(0, 2))).toEqual([second, first])
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

  test('Alt+Down moves an area in the sidebar and the order survives a reload', async ({ page }) => {
    await startEmpty(page)
    const [first, second] = await areaNames(page)
    const button = areaItem(page, 0).locator('.side__area')
    await button.focus()
    await page.keyboard.press('Alt+ArrowDown')

    await expect(page.locator('.toast', { hasText: `Moved ‘${first}’` })).toBeVisible()
    expect((await areaNames(page)).slice(0, 2)).toEqual([second, first])
    await expect(areaItem(page, 1).locator('.side__area')).toBeFocused()

    // Default areas carry no updatedAt, so this spans the end of the first and the start of the moved one.
    await expectPersisted(page, '"color":"magenta"},{"id":"classes"')
    await page.reload()
    expect((await areaNames(page)).slice(0, 2)).toEqual([second, first])
  })

  test('dragging an area by its grip reorders the sidebar; a plain click still opens it', async ({ page }) => {
    await startEmpty(page)
    const [first, second, third] = await areaNames(page)
    await areaItem(page, 0).hover()
    const grip = (await areaItem(page, 0).locator('.side__grip').boundingBox())!
    const target = (await areaItem(page, 2).boundingBox())!
    await dragTo(page, centre(grip), { x: grip.x + grip.width / 2, y: target.y + target.height * 0.8 })
    await expect.poll(() => areaNames(page).then((n) => n.slice(0, 3))).toEqual([second, third, first])
    await expect(page.locator('.toast', { hasText: `Moved ‘${first}’` })).toBeVisible()
    await expect(page).not.toHaveURL(/#area/)

    await areaItem(page, 0).locator('.side__area').click()
    await expect(page).toHaveURL(/#area\//)
  })

  test('pressing and moving an area with the mouse reorders it', async ({ page }) => {
    await startEmpty(page)
    const [first, second] = await areaNames(page)
    const from = (await areaItem(page, 1).locator('.side__area').boundingBox())!
    const to = (await areaItem(page, 0).boundingBox())!
    await dragTo(page, centre(from), { x: from.x + from.width / 2, y: to.y + 2 })
    await expect.poll(() => areaNames(page).then((n) => n.slice(0, 2))).toEqual([second, first])
    await expect(page).not.toHaveURL(/#area/)
  })

  test('dragging a task on Today reorders the panel and switches to My order', async ({ page }) => {
    await seedToday(page)
    const today = panel(page, 'today-h')
    const [first, second, third] = await panelTitles(page, 'today-h')
    const upNext = await page.locator('.next__title').textContent()
    const row = today.locator('.trow').first()
    await row.hover()
    const grip = (await row.locator('.trow__grip').boundingBox())!
    const target = (await today.locator('.trow').nth(2).boundingBox())!
    await dragTo(page, centre(grip), { x: grip.x + grip.width / 2, y: target.y + target.height * 0.8 })

    await expect.poll(() => panelTitles(page, 'today-h').then((t) => t.slice(0, 3))).toEqual([second, third, first])
    await expect(page.locator('.toast', { hasText: 'Switched to My order' })).toBeVisible()
    await expectPersisted(page, '"sort":"manual"')
    await page.reload()
    await expect.poll(() => panelTitles(page, 'today-h').then((t) => t.slice(0, 3))).toEqual([second, third, first])
    // My order makes Up next the top of Today; reordering the panel below it must not change it.
    await expect(page.locator('.next__title')).toHaveText(upNext ?? '')
  })

  test('dragging a task from This week into Today moves it to today', async ({ page }) => {
    await seedToday(page)
    const [moved] = await panelTitles(page, 'week-h')
    const row = panel(page, 'week-h').locator('.trow').first()
    await row.hover()
    const grip = (await row.locator('.trow__grip').boundingBox())!
    const target = (await panel(page, 'today-h').locator('.trow').first().boundingBox())!
    await dragTo(page, centre(grip), { x: target.x + 40, y: target.y + 4 })

    await expect(page.locator('.toast', { hasText: 'Moved to Today' })).toBeVisible()
    // The planner's sort stays on, so it places the task; only its "when" changed.
    await expect.poll(() => panelTitles(page, 'today-h')).toContain(moved)
    await expect.poll(() => panelTitles(page, 'week-h')).not.toContain(moved)
  })
})
