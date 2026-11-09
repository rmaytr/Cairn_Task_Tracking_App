import { describe, expect, it } from 'vitest'
import { DEFAULT_AREAS, NOW } from '../../lib/__tests__/areas'
import { captureItems, previewCapture } from '../useAddTask'

describe('captureItems', () => {
  it('turns each line into a draft with its own area, date and priority', () => {
    const items = captureItems(['Email mentee #orgs tomorrow !', 'Finish the calculus homework'], null, DEFAULT_AREAS, NOW)
    expect(items).toEqual([
      { draft: { title: 'Email mentee', due: '2026-10-22', high: true, horizon: 'week' }, areaId: 'orgs', text: 'Email mentee #orgs tomorrow !' },
      { draft: { title: 'Finish the calculus homework', horizon: 'week' }, areaId: 'classes', text: 'Finish the calculus homework' },
    ])
  })

  it('puts every line in a forced area', () => {
    const items = captureItems(['Buy milk', 'Call the bank'], 'career', DEFAULT_AREAS, NOW)
    expect(items.map((i) => i.areaId)).toEqual(['career', 'career'])
  })

  it('keeps repeat and effort guesses', () => {
    const [item] = captureItems(['Water plants every week 10 min'], null, DEFAULT_AREAS, NOW)
    expect(item?.draft).toMatchObject({ title: 'Water plants', repeat: 'weekly', effort: 's' })
  })

  it('skips lines that leave no title', () => {
    expect(captureItems(['  ', 'Buy milk'], null, DEFAULT_AREAS, NOW)).toHaveLength(1)
  })
})

describe('previewCapture', () => {
  it('shows repeat and effort', () => {
    expect(previewCapture('Stretch 15 min every day', null, DEFAULT_AREAS)).toMatchObject({
      title: 'Stretch',
      repeat: 'daily',
      effort: 's',
    })
  })
})
