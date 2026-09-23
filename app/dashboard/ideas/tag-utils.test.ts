import { describe, expect, it } from 'vitest'

import { joinTagList, parseTagList } from './tag-utils'

describe('parseTagList', () => {
  it('splits comma-separated tokens, trimming whitespace', () => {
    expect(parseTagList('react, node ,  design')).toEqual([
      'react',
      'node',
      'design',
    ])
  })

  it('dedupes case-sensitively after trimming', () => {
    expect(parseTagList('react, React, react')).toEqual(['react', 'React'])
  })

  it('caps the list at max', () => {
    const many = Array.from({ length: 15 }, (_, i) => `tag${i}`).join(',')
    expect(parseTagList(many, 5)).toHaveLength(5)
  })

  it('returns [] for empty / blank input', () => {
    expect(parseTagList('')).toEqual([])
    expect(parseTagList('   ,  , ')).toEqual([])
  })
})

describe('joinTagList', () => {
  it('joins with the given separator and empty string for []', () => {
    expect(joinTagList(['a', 'b'], ', ')).toBe('a, b')
    expect(joinTagList([], ', ')).toBe('')
  })

  it('uses the default separator', () => {
    expect(joinTagList(['a', 'b'])).toBe('a, b')
  })
})
