import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../src/api/client.ts'
import { startPoller } from '../src/shared/polling/poller.ts'
import { usePolling } from '../src/shared/polling/usePolling.ts'

afterEach(() => vi.useRealTimers())
describe('폴링', () => {
  it('이전 요청이 끝나기 전 중복 요청을 보내지 않는다', async () => {
    vi.useFakeTimers()
    let resolve!: (value: number) => void
    const fetch = vi.fn(() => new Promise<number>((done) => { resolve = done }))
    const stop = startPoller({ fetch, isDone: () => false, classifyError: () => 'retry', onUpdate: () => {} })
    await vi.advanceTimersByTimeAsync(10000)
    expect(fetch).toHaveBeenCalledTimes(1)
    resolve(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(2)
    stop()
  })
  it('실패 시 2, 4, 8, 8초 후 재시도하고 5회 실패 후 멈춘다', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockRejectedValue(new Error('offline'))
    const updates = vi.fn()
    const stop = startPoller({ fetch, isDone: () => false, classifyError: () => 'retry', onUpdate: updates })
    await vi.advanceTimersByTimeAsync(0)
    for (const delay of [2000, 4000, 8000, 8000]) {
      const count = fetch.mock.calls.length
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(fetch).toHaveBeenCalledTimes(count)
      await vi.advanceTimersByTimeAsync(1)
      expect(fetch).toHaveBeenCalledTimes(count + 1)
    }
    expect(updates).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'failed', retrying: false }))
    await vi.advanceTimersByTimeAsync(20000)
    expect(fetch).toHaveBeenCalledTimes(5)
    stop()
  })
  it('수동 재시도는 같은 대상의 데이터를 유지하고 대상 변경은 비우며 비활성화 시 idle이다', async () => {
    let resolve!: (value: number) => void
    const error = new ApiError({ status: 400, code: 'BAD', message: 'error', retryable: false })
    const fetch = vi.fn().mockResolvedValueOnce(42).mockRejectedValueOnce(error).mockImplementation(() => new Promise<number>((done) => { resolve = done }))
    const { result, rerender } = renderHook(({ resetKey, enabled }) => usePolling({ fetch, isDone: () => false, resetKey, enabled, intervalMs: 1 }), { initialProps: { resetKey: 'a', enabled: true } })
    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.data).toBe(42)
    act(() => result.current.retry())
    expect(result.current).toMatchObject({ status: 'polling', error: null, data: 42 })
    rerender({ resetKey: 'b', enabled: true })
    expect(result.current.data).toBeNull()
    rerender({ resetKey: 'b', enabled: false })
    expect(result.current.status).toBe('idle')
    act(() => resolve(99))
  })
})
