import { describe, expect, it } from 'vitest'
import { findSimilar, guessSplit, similarity, splitLines } from '../brainDump'

describe('splitLines', () => {
  it('keeps a single line as one item', () => {
    expect(splitLines('Email mentee #orgs tomorrow !')).toEqual(['Email mentee #orgs tomorrow !'])
  })

  it('returns nothing for empty or blank text', () => {
    expect(splitLines('')).toEqual([])
    expect(splitLines(' \n\t\n  ')).toEqual([])
  })

  it('splits on newlines, trims and drops empty lines', () => {
    expect(splitLines('  buy milk \n\n call mom\r\n')).toEqual(['buy milk', 'call mom'])
  })

  it.each([
    ['- buy milk\n- call mom', ['buy milk', 'call mom']],
    ['* buy milk\n* call mom', ['buy milk', 'call mom']],
    ['• buy milk\n• call mom', ['buy milk', 'call mom']],
    ['– buy milk\n— call mom', ['buy milk', 'call mom']],
    ['+ buy milk\n+ call mom', ['buy milk', 'call mom']],
    ['1. buy milk\n2. call mom', ['buy milk', 'call mom']],
    ['1) buy milk\n12) call mom', ['buy milk', 'call mom']],
    ['  - indented\n    - nested', ['indented', 'nested']],
  ])('strips list markers from %j', (text, items) => {
    expect(splitLines(text)).toEqual(items)
  })

  it('strips open checkboxes and skips checked ones', () => {
    expect(splitLines('- [ ] buy milk\n- [x] already done\n[X] also done\n[ ] call mom\n- [] pay rent')).toEqual([
      'buy milk',
      'call mom',
      'pay rent',
    ])
  })

  it('splits on semicolons', () => {
    expect(splitLines('buy milk; call mom ;; pay rent')).toEqual(['buy milk', 'call mom', 'pay rent'])
  })

  it('keeps a semicolon inside a link', () => {
    expect(splitLines('read https://example.com/a;b=1?x=2;y=3')).toEqual(['read https://example.com/a;b=1?x=2;y=3'])
    expect(splitLines('read https://example.com/a;b=1; call mom')).toEqual(['read https://example.com/a;b=1', 'call mom'])
  })

  it('drops headings that end with a colon and markdown headings', () => {
    expect(splitLines('Groceries:\n- milk\n- eggs\n## This week\nCall mom')).toEqual(['milk', 'eggs', 'Call mom'])
  })

  it('never drops a single typed line', () => {
    expect(splitLines('Ask the professor about:')).toEqual(['Ask the professor about:'])
    expect(splitLines('  [x] odd but typed ')).toEqual(['[x] odd but typed'])
  })

  it('keeps a colon inside a line', () => {
    expect(splitLines('Re: rent email landlord')).toEqual(['Re: rent email landlord'])
  })

  it('does not treat numbers or #tags at the start as markers', () => {
    expect(splitLines('1.5 hours of reading\n-5 degrees check heater\n#orgs email mentee')).toEqual([
      '1.5 hours of reading',
      '-5 degrees check heater',
      '#orgs email mentee',
    ])
  })

  it('drops a bare marker with no text', () => {
    expect(splitLines('-\n- [ ]\n1.\nbuy milk')).toEqual(['buy milk'])
  })
})

describe('guessSplit', () => {
  it.each([
    ['call mom, buy milk and finish the essay', ['call mom', 'buy milk', 'finish the essay']],
    ['email Sam and also book flights', ['email Sam', 'book flights']],
    ['do laundry, then vacuum', ['do laundry', 'vacuum']],
    ['do laundry then vacuum the stairs', ['do laundry', 'vacuum the stairs']],
    ['Look up flights and book a hotel', ['Look up flights', 'book a hotel']],
    ['pay rent, call the bank, and renew my visa', ['pay rent', 'call the bank', 'renew my visa']],
    ['pick up Tom and Ana from school, pay rent', ['pick up Tom and Ana from school', 'pay rent']],
    ['I need to call mom and buy milk', ['call mom', 'buy milk']],
    ['dentist appointment, car insurance renewal, birthday gift for Ana', ['dentist appointment', 'car insurance renewal', 'birthday gift for Ana']],
    ['Call mom tomorrow, buy milk #life', ['Call mom tomorrow', 'buy milk #life']],
  ])('splits %j', (line, parts) => {
    expect(guessSplit(line)).toEqual(parts)
  })

  it.each([
    'salt and pepper',
    'Read chapters 3 and 4',
    'Rock, paper, scissors',
    'Buy eggs, milk, bread',
    'Call Mom and Dad',
    'Write and submit the essay',
    'Read pages 1, 2, 3',
    'Finish lab report by Friday',
    'Pros and cons list for the internship',
    '',
    'buy milk',
    'check https://example.com/?a=1;buy=2',
  ])('does not split %j', (line) => {
    expect(guessSplit(line)).toBeNull()
  })
})

describe('similarity', () => {
  it('is 1 for the same words ignoring case, punctuation and filler words', () => {
    expect(similarity('Call the bank', 'call bank!')).toBe(1)
  })

  it('is high for a typo', () => {
    expect(similarity('Call teh bank', 'Call the bank')).toBeGreaterThanOrEqual(0.8)
  })

  it('is low for different tasks that share a verb', () => {
    expect(similarity('Call the bank', 'Call the dentist')).toBeLessThan(0.8)
    expect(similarity('Run', 'Fun')).toBeLessThan(0.8)
  })

  it('is 0 when either side has no words', () => {
    expect(similarity('', 'Call the bank')).toBe(0)
    expect(similarity('the', 'the')).toBe(0)
  })
})

describe('findSimilar', () => {
  const tasks = [
    { id: 'a', title: 'Call the bank', done: false },
    { id: 'b', title: 'Buy stamps', done: true },
    { id: 'c', title: 'Finish the calculus homework', done: false },
  ]

  it('finds an open task with a very similar title', () => {
    expect(findSimilar('call bank', tasks)?.id).toBe('a')
    expect(findSimilar('Finish calculus homework', tasks)?.id).toBe('c')
  })

  it('ignores done tasks', () => {
    expect(findSimilar('Buy stamps', tasks)).toBeNull()
  })

  it('ignores very short or unrelated text', () => {
    expect(findSimilar('ca', tasks)).toBeNull()
    expect(findSimilar('Call the dentist', tasks)).toBeNull()
  })
})
