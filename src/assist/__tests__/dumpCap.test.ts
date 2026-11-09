import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore'
import { MAX_DUMP_SORTS, useAddTasks } from '../useAddTask'

const enrich = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../enrich', () => ({ enrichWithAssistant: enrich }))

describe('useAddTasks', () => {
  it('adds every line but asks the assistant about at most MAX_DUMP_SORTS of them', async () => {
    const before = useStore.getState().tasks.length
    const lines = Array.from({ length: MAX_DUMP_SORTS + 5 }, (_, i) => `Task number ${i + 1}`)
    const { result } = renderHook(() => useAddTasks())

    const ids = result.current(lines)
    await vi.waitFor(() => expect(enrich).toHaveBeenCalledTimes(MAX_DUMP_SORTS))

    expect(ids).toHaveLength(lines.length)
    expect(useStore.getState().tasks.length - before).toBe(lines.length)
    expect(enrich.mock.calls.map((c) => (c as unknown[])[0])).toEqual(ids.slice(0, MAX_DUMP_SORTS))
  })
})
