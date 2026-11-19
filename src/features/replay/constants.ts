/**
 * 저장된 실측 결과 재생에 쓰는 고정 실험 목록(OI-7). 실험마다 `experimentKey` 하나이고,
 * 값은 백엔드 `results/final_execution_plan.json`(`final-plan-1119`)의 `replay`와 같다.
 * mock 모드에서는 첫 키(`e-s1-1119`)만 시드가 있고 나머지는 목록이 비어 보인다(`src/mocks/store.ts`).
 */
export const REPLAY_EXPERIMENTS: readonly { key: string; label: string }[] = [
  { key: 'e-s1-1119', label: '환불' },
  { key: 'e-s2-1119', label: '배송' },
  { key: 'e-s3-1119', label: '쿠폰' },
  { key: 'e-s4-1119', label: '문의' },
]

/** 재생 대상 `experimentKey`인지. 재생 표시(`ReplayNotice`)가 이 값으로 화면을 고른다 */
export function isReplayKey(experimentKey: string): boolean {
  return REPLAY_EXPERIMENTS.some(({ key }) => key === experimentKey)
}

/** 실제 모델 실행(`LIVE`) 결과를 재생할 때의 표시 */
export const REPLAY_LABEL = '저장된 실측 결과 재생'

/** `resultOrigin`에 `MOCK`이 섞인 재생에는 실측이라고 표시하지 않는다 */
export const REPLAY_MOCK_LABEL = 'MOCK 재생 테스트'
