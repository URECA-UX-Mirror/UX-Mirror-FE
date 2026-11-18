/**
 * 저장된 실측 결과 재생에 쓰는 고정 실험 목록(OI-7). 실험마다 `experimentKey` 하나이고,
 * E 실행의 목표별(환불·주문·고객센터) 키를 백엔드 `results/final_execution_plan.json`에서 받아 채운다.
 * 값을 받기 전까지는 mock 시드(`mock-done`) 하나만 있는 `임시` 값이며, 실서버에서는 이 키의 Run이 없어 목록이 비어 보인다.
 */
export const REPLAY_EXPERIMENTS: readonly { key: string; label: string }[] = [
  { key: 'mock-done', label: '시연 예시 (임시)' },
]

/** 재생 대상 `experimentKey`인지. 재생 표시(`ReplayNotice`)가 이 값으로 화면을 고른다 */
export function isReplayKey(experimentKey: string): boolean {
  return REPLAY_EXPERIMENTS.some(({ key }) => key === experimentKey)
}

/** 실제 모델 실행(`LIVE`) 결과를 재생할 때의 표시 */
export const REPLAY_LABEL = '저장된 실측 결과 재생'

/** `resultOrigin`에 `MOCK`이 섞인 재생에는 실측이라고 표시하지 않는다 */
export const REPLAY_MOCK_LABEL = 'MOCK 재생 테스트'
