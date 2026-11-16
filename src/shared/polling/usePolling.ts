import { useCallback, useEffect, useRef, useState } from 'react'
import { isApiError } from '../../api/client.ts'
import {
  startPoller,
  type ErrorKind,
  type PollingState,
} from './poller.ts'

export type { PollingState, PollingStatus } from './poller.ts'

export interface UsePollingOptions<T> {
  /** 무엇을 조회하는지는 호출하는 쪽이 정한다(Run 조회, 이슈 재조회 등) */
  fetch: (signal: AbortSignal) => Promise<T>
  /** 응답이 중단 조건을 만족하는지 판정한다. Run 종료 판정은 `isTerminalStatus`를 쓴다 */
  isDone: (data: T) => boolean
  /** 조회 대상이 바뀌면(예: `runId`) 바꾼다. 값이 바뀌면 기존 루프를 취소하고 새로 시작한다 */
  resetKey: string
  /** `false`이면 조회하지 않고 `status`는 `'idle'`이다 */
  enabled?: boolean
  intervalMs?: number
  /** 첫 조회 뒤에 다시 조회할 최대 횟수(응답을 받은 재조회만 센다). 이슈 `PENDING` 재조회는 5. 없으면 제한하지 않는다 */
  maxRefetches?: number
}

export interface UsePollingResult<T> extends PollingState<T> {
  /** 멈춘 폴링(`failed`, `exhausted`)을 처음부터 다시 시작한다. 수동 재시도 버튼에 쓴다 */
  retry: () => void
}

/** `404`(대상 없음)와 `retryable=false` 오류는 재시도하지 않는다. API 오류가 아닌 예외는 반복해도 같으므로 멈춘다. */
function classifyError(error: unknown): ErrorKind {
  if (!isApiError(error)) return 'stop'
  if (error.status === 404 || !error.retryable) return 'stop'
  return 'retry'
}

const INITIAL: PollingState<never> = {
  status: 'polling',
  data: null,
  error: null,
  retrying: false,
}

interface Tagged<T> {
  /** 어느 시도(`retry` 포함)의 결과인지 */
  token: string
  /** 어느 조회 대상의 결과인지. 같은 대상이면 `retry` 뒤에도 `data`를 이어 쓴다 */
  resetKey: string
  state: PollingState<T>
}

/**
 * 범용 폴링 훅. 같은 대상에 루프를 하나만 두고, 이전 요청이 끝나기 전에는 다음 요청을 보내지 않으며,
 * 화면을 벗어나거나 `resetKey`가 바뀌면 타이머와 요청을 취소한다. 간격·backoff 규칙은 `poller.ts`에 있다.
 */
export function usePolling<T>(
  options: UsePollingOptions<T>,
): UsePollingResult<T> {
  const { resetKey, enabled = true, intervalMs, maxRefetches } = options
  const [attempt, setAttempt] = useState(0)
  const [tagged, setTagged] = useState<Tagged<T> | null>(null)
  const token = `${attempt}:${resetKey}`

  // 렌더마다 새로 만들어지는 함수가 루프를 다시 시작하지 않도록 최신 값을 ref로 읽는다.
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  useEffect(() => {
    if (!enabled) return
    return startPoller<T>({
      fetch: (signal) => latest.current.fetch(signal),
      isDone: (data) => latest.current.isDone(data),
      classifyError,
      onUpdate: (state) =>
        setTagged((prev) => ({
          token,
          resetKey,
          state: {
            ...state,
            // 새로 시작한 루프는 `data`가 비어 있으므로 같은 대상의 직전 성공 응답을 이어 붙인다.
            data:
              state.data ??
              (prev?.resetKey === resetKey ? prev.state.data : null),
          },
        })),
      intervalMs,
      maxRefetches,
    })
  }, [token, resetKey, enabled, intervalMs, maxRefetches])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  // 다른 대상의 결과는 보이지 않게 한다. 같은 대상에서 `retry`로 다시 시작했을 때는
  // 새 응답이 오기 전까지 상태·오류는 초기화하고 직전 `data`만 유지한다.
  let state: PollingState<T> = INITIAL
  if (tagged?.token === token) state = tagged.state
  else if (tagged?.resetKey === resetKey) {
    state = { ...INITIAL, data: tagged.state.data }
  }
  // 꺼져 있으면 조회 중이 아니다. 마지막 오류·재시도 표시를 지우고 `data`만 남긴다.
  if (!enabled) {
    state = { status: 'idle', data: state.data, error: null, retrying: false }
  }
  return { ...state, retry }
}
