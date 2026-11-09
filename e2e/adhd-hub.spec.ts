import { expect, test, type Page } from '@playwright/test'
import { expectPersisted, sideButton, startEmpty } from './helpers'

const hubHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'ADHD toolkit' })
const library = (page: Page) => page.getByRole('region', { name: 'All cards' })
const playbook = (page: Page) => page.getByRole('region', { name: 'My playbook' })

test.describe('ADHD toolkit hub', () => {
  test('opens from the sidebar and with key 4, and shows the tools', async ({ page }) => {
    await startEmpty(page)
    await sideButton(page, 'ADHD toolkit').click()
    await expect(page).toHaveURL(/#adhd$/)
    await expect(hubHeading(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start a block' })).toBeVisible()
    await expect(page.locator('.hub-tool')).toHaveCount(6)
    await expect(page.getByRole('region', { name: 'Today’s card' }).getByRole('article')).toHaveCount(1)
    await expect(page.getByText('Cairn isn’t medical advice.', { exact: false })).toBeVisible()

    await page.keyboard.press('1')
    await expect(page).toHaveURL(/#home$/)
    await page.keyboard.press('4')
    await expect(hubHeading(page)).toBeVisible()
  })

  test('a card marked "Helps me" lands in My playbook and survives a reload', async ({ page }) => {
    await startEmpty(page)
    await page.goto('/#adhd')
    await page.locator('.hub-tool', { hasText: 'What works' }).click()
    await expect(page).toHaveURL(/#adhd\/learn$/)
    await expect(playbook(page).getByRole('article')).toHaveCount(0)

    const card = library(page).getByRole('article', { name: 'Fresh starts give a boost' })
    await card.getByRole('button', { name: 'Helps me' }).click()
    await expect(card.getByRole('button', { name: 'Helps me' })).toHaveAttribute('aria-pressed', 'true')
    await expect(playbook(page).getByRole('article', { name: 'Fresh starts give a boost' })).toBeVisible()

    await expectPersisted(page, '"fresh-start":"helps"')
    await page.reload()
    await expect(playbook(page).getByRole('article', { name: 'Fresh starts give a boost' })).toBeVisible()
  })

  test('each "Right now" chip opens the right tool', async ({ page }) => {
    await startEmpty(page)
    const cases: [string, string][] = [
      ['Start something', 'room'],
      ['Get unstuck', 'unstuck'],
      ['Quiet my head', 'sounds'],
      ['Take a break', 'move'],
      ['Reward myself', 'treats'],
    ]
    for (const [label, tool] of cases) {
      await page.goto('/#adhd')
      await page.getByRole('group', { name: 'Right now I need to…' }).getByRole('button', { name: label }).click()
      await expect(page).toHaveURL(new RegExp(`#adhd/${tool}$`))
    }
  })

  test('a corrected link replaces itself, so Back skips it', async ({ page }) => {
    await startEmpty(page)
    await expect(page).toHaveURL(/#home$/)
    await page.evaluate(() => {
      location.hash = '#adhd/bogus'
    })
    await expect(page).toHaveURL(/#adhd$/)
    await page.goBack()
    await expect(page).toHaveURL(/#home$/)
  })

  test('fits a phone screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await startEmpty(page)
    for (const hash of ['#adhd', '#adhd/learn']) {
      await page.goto(`/${hash}`)
      await expect(page.locator('.adhd')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, hash).toBeLessThanOrEqual(0)
    }
  })
})
