/**
 * 저장된 실측 결과 재생에 쓰는 고정 `experimentKey`(OI-7).
 * 백엔드 `results/final_execution_plan.json`의 값으로 바꿔야 한다. 값을 받기 전까지는
 * mock 시드(`mock-done`)를 쓰는 `임시` 값이며, 실서버에서는 이 키의 Run이 없어 목록이 비어 보인다.
 */
export const REPLAY_EXPERIMENT_KEY = 'mock-done'

export const REPLAY_LABEL = '저장된 실측 결과 재생'
