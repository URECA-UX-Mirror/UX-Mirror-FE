import { REPLAY_EXPERIMENT_KEY, REPLAY_LABEL } from './constants.ts'

/**
 * 고정 재생 키의 Run·비교 화면에만 "저장된 실측 결과 재생" 표시를 보인다.
 * `resultOrigin` 배지와 별개이며 원본 값(`LIVE`)은 바꾸지 않는다.
 */
export function ReplayNotice({ experimentKey }: { experimentKey: string }) {
  if (experimentKey !== REPLAY_EXPERIMENT_KEY) return null
  return (
    <p className="replay-notice" role="note">
      {REPLAY_LABEL}
    </p>
  )
}
