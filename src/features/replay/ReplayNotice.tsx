import {
  isReplayKey,
  REPLAY_LABEL,
  REPLAY_MOCK_LABEL,
} from './constants.ts'

const MEASURED_ORIGINS = ['LIVE', 'SAVED_MEASURED']

interface ReplayNoticeProps {
  experimentKey: string
  /** 화면이 보여 주는 데이터의 `resultOrigin`. 비교 화면은 두 버전 모두 넘긴다 */
  origins: string[]
}

/**
 * 고정 재생 키(여러 개 가능)의 화면에만 재생 표시를 보인다. `resultOrigin` 배지와 별개이며 원본 값은 바꾸지 않는다.
 * 모든 출처가 실제 실행(`LIVE`, `SAVED_MEASURED`)일 때만 "실측"이라고 쓰고, 그 밖에는 예시 데이터 표시를 쓴다.
 */
export function ReplayNotice({ experimentKey, origins }: ReplayNoticeProps) {
  if (!isReplayKey(experimentKey)) return null
  const measured = origins.every((origin) => MEASURED_ORIGINS.includes(origin))
  return (
    <p className="replay-notice" role="note">
      {measured ? REPLAY_LABEL : REPLAY_MOCK_LABEL}
    </p>
  )
}
