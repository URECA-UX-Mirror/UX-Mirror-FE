// 폴링 엔진. React와 API 계층을 모르는 순수 로직이다. 규칙은 docs/contracts/run-lifecycle.md의
// "폴링 규칙"과 "오류 처리"를 따른다. 재시도 횟수와 상한은 `임시`다.

/** 기본 폴링 간격(ms). 간격은 이 상수 한 곳에서 바꾼다(`임시`). */
export const POLL_INTERVAL_MS = 1000
/** 오류 backoff 간격의 상한(ms). 1 → 2 → 4 → 8초(`임시`). */
export const MAX_BACKOFF_MS = 8000
/** 연속 실패가 이 횟수에 도달하면 폴링을 멈추고 수동 재시도를 기다린다(`임시`). */
export const MAX_CONSECUTIVE_FAILURES = 5

export type PollingStatus =
  /** 조회 중이거나 다음 조회를 기다린다 */
  | 'polling'
  /** `isDone`이 참이라 멈췄다 */
  | 'done'
  /** `maxRefetches`번 다시 조회했지만 끝나지 않아 멈췄다 */
  | 'exhausted'
  /** 재시도 불가 오류이거나 연속 실패 한도에 도달해 멈췄다. `error`를 본다 */
  | 'failed'

export interface PollingState<T> {
  status: PollingStatus
  /** 마지막으로 성공한 응답. 오류가 나도 지우지 않는다 */
  data: T | null
  /** 마지막 조회가 실패했으면 그 오류. 다음 조회가 성공하면 `null` */
  error: unknown
  /** 오류 뒤 재시도를 기다리는 중이다. "연결 재시도 중" 표시에 쓴다 */
  retrying: boolean
}

export type ErrorKind = 'retry' | 'stop'

export interface PollerOptions<T> {
  fetch: (signal: AbortSignal) => Promise<T>
  /** 응답이 중단 조건을 만족하는지 판정한다(예: 종료 상태, `analysisStatus !== 'PENDING'`) */
  isDone: (data: T) => boolean
  /** 오류를 다시 시도할지 판정한다. `AbortError`는 여기까지 오지 않는다 */
  classifyError: (error: unknown) => ErrorKind
  onUpdate: (state: PollingState<T>) => void
  intervalMs?: number
  /**
   * 첫 조회 뒤에 다시 조회할 최대 횟수. 응답을 받은 재조회만 센다(실패한 조회는 세지 않는다).
   * 예: 5이면 첫 조회 1회 + 재조회 5회까지 조회한다. 없으면 제한하지 않는다.
   */
  maxRefetches?: number
}

function isAbortError(value: unknown): boolean {
  return value instanceof DOMException && value.name === 'AbortError'
}

/** 연속 실패 `failures`회 뒤 다음 조회까지 기다릴 시간. 성공하면 `failures`가 0이라 기본 간격으로 돌아간다. */
export function nextDelay(intervalMs: number, failures: number): number {
  return Math.min(intervalMs * 2 ** failures, Math.max(MAX_BACKOFF_MS, intervalMs))
}

/**
 * 폴링을 시작한다. 첫 조회는 바로 보내고 이후는 이전 요청이 끝난 뒤에만 보낸다.
 * 반환한 함수를 호출하면 타이머와 진행 중인 요청을 취소하고 이후 `onUpdate`를 부르지 않는다.
 */
export function startPoller<T>(options: PollerOptions<T>): () => void {
  const {
    fetch: fetchOnce,
    isDone,
    classifyError,
    onUpdate,
    intervalMs = POLL_INTERVAL_MS,
    maxRefetches,
  } = options

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let data: T | null = null
  let responses = 0
  let failures = 0

  const emit = (status: PollingStatus, error: unknown, retrying: boolean) => {
    if (controller.signal.aborted) return
    onUpdate({ status, data, error, retrying })
  }

  const schedule = (delay: number) => {
    timer = setTimeout(() => void tick(), delay)
  }

  async function tick() {
    try {
      const response = await fetchOnce(controller.signal)
      if (controller.signal.aborted) return
      data = response
      responses += 1
      failures = 0
      if (isDone(response)) return emit('done', null, false)
      // 첫 응답은 재조회가 아니므로 `responses - 1`이 재조회 횟수다.
      if (maxRefetches !== undefined && responses - 1 >= maxRefetches) {
        return emit('exhausted', null, false)
      }
      emit('polling', null, false)
      schedule(intervalMs)
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return
      failures += 1
      if (
        classifyError(error) === 'stop' ||
        failures >= MAX_CONSECUTIVE_FAILURES
      ) {
        return emit('failed', error, false)
      }
      emit('polling', error, true)
      schedule(nextDelay(intervalMs, failures))
    }
  }

  void tick()
  return () => {
    controller.abort()
    clearTimeout(timer)
  }
}
