/** 서버 코드값 → 사용자에게 보여 줄 말. 화면에는 코드값을 그대로 보이지 않는다 */

/** 진단이 멈춘 이유 (`terminationReason`, BE `uxm/agent.py`) */
const STOP_REASONS: Record<string, string> = {
  GOAL_VERIFIED: '목표 화면에 도착했어요',
  REVISIT_LIMIT_REACHED: '같은 화면을 계속 다시 찾아가서 멈췄어요',
  MAX_STEPS_REACHED: '정해진 클릭 수 안에 찾지 못했어요',
  RUN_TIMEOUT: '3분 안에 끝나지 않아 멈췄어요',
  NO_CANDIDATES: '더 누를 곳이 없어 멈췄어요',
  NO_VALID_CANDIDATES: '더 누를 곳이 없어 멈췄어요',
  BACK_RECOVERY_FAILED: '이전 화면으로 돌아가지 못해 멈췄어요',
  MODEL_TIMEOUT: 'AI 응답이 늦어 진단을 끝내지 못했어요. 다시 시작해 주세요',
  MODEL_ERROR: 'AI 응답에 문제가 있어 진단을 끝내지 못했어요. 다시 시작해 주세요',
  PAGE_LOAD_FAILED: '화면을 여는 데 실패해 진단을 끝내지 못했어요. 다시 시작해 주세요',
  BROWSER_ERROR: '일시적인 문제로 진단을 끝내지 못했어요. 다시 시작해 주세요',
  LEAK_CHECK_FAILED: '입력에 쓸 수 없는 말이 있어 진단을 멈췄어요',
  STORAGE_FAILED: '결과를 저장하지 못했어요. 다시 시작해 주세요',
}

export function stopReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null
  return STOP_REASONS[reason] ?? '진단이 끝났어요'
}

/** 발견한 문제 유형 (`issueType`, 계약 §14) */
const ISSUE_TYPES: Record<string, string> = {
  GOAL_NOT_REACHED: '목표에 도달하지 못함',
  REFERENCE_PATH_DEVIATION: '가장 짧은 길에서 벗어남',
  REPEATED_VISIT: '같은 화면 반복 방문',
  EXTRA_STEPS: '필요보다 많이 클릭함',
  CHOICE_AMBIGUITY: '고르기 어려운 화면',
}

export const issueTypeLabel = (type: string) => ISSUE_TYPES[type] ?? '확인이 필요한 점'
