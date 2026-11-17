interface RunGaugeProps {
  /** 지금까지 끝난 탐색 단계 수 */
  stepCount: number
  /** 허용된 최대 단계 수 */
  maxSteps: number
  /** 실행이 끝났는지. 끝나기 전에는 다음 칸이 채워지는 중으로 보인다 */
  terminal: boolean
  /** 실행 상태. 끝난 뒤의 채움 색을 정하고, `READY`(대기)이면 아직 탐색 전으로 보인다 */
  status: string
}

/**
 * 탐색 진행 게이지. 최대 단계 수만큼 칸을 나누고 끝난 단계는 채우며,
 * 진행 중이면 다음 칸이 줄무늬로 차오른다. 값은 `progressbar`로도 노출한다.
 */
export function RunGauge({ stepCount, maxSteps, terminal, status }: RunGaugeProps) {
  const total = Math.max(1, maxSteps)
  const done = Math.min(stepCount, total)
  const percent = Math.round((done / total) * 100)
  // 대기 상태에서는 아직 탐색을 시작하지 않았으므로 차오르는 칸을 두지 않는다
  const waiting = !terminal && status === 'READY'
  const cells = Array.from({ length: total }, (_, index) => {
    const order = index + 1
    if (order <= done) return 'done'
    if (!terminal && !waiting && order === done + 1) return 'active'
    return 'pending'
  })
  return (
    <div className="run-gauge" data-status={status} data-running={terminal || waiting ? undefined : 'true'}>
      <div className="run-gauge-head">
        <span className="run-gauge-title">
          {terminal ? '탐색 종료' : waiting ? '탐색 시작 전' : '탐색 중'}
          {terminal || waiting ? null : <i className="run-gauge-dot" aria-hidden="true" />}
        </span>
        <span className="run-gauge-value num">
          <strong>{done}</strong> / {total}단계 · {percent}%
        </span>
      </div>
      <div
        className="run-gauge-track"
        role="progressbar"
        aria-label="탐색 진행률"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${total}단계 중 ${done}단계`}
      >
        {cells.map((state, index) => (
          <span key={index} className="run-gauge-cell" data-state={state}>
            <span className="run-gauge-fill" />
          </span>
        ))}
      </div>
    </div>
  )
}
