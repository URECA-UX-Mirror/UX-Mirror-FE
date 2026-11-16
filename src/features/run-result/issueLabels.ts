import type { Open, ReviewPriority } from '../../domain/types.ts'

/** 우선순위는 두 단계만 쓴다. 높음·보통·참고 같은 심각도 표현은 쓰지 않는다. */
export function priorityLabel(priority: Open<ReviewPriority>): string {
  switch (priority) {
    case 'PRIORITY_REVIEW':
      return '우선 검토'
    case 'GENERAL_REVIEW':
      return '일반 검토'
    default:
      return priority
  }
}

/** `evidence` 키의 표시 이름(`임시`, 계약서에 표시 이름은 없다). 표에 없는 키는 키 이름 그대로 보인다. */
const EVIDENCE_LABELS: Record<string, string> = {
  status: '종료 상태',
  terminationReason: '종료 사유',
  stepCount: '탐색 단계',
  pageSignature: '화면 식별값',
  visitCount: '방문 횟수',
  visitCauses: '방문 사유',
  successfulNavigationClickCount: '이동에 성공한 클릭 수',
  shortestAllowedSteps: '허용 최단 경로 단계 수',
  extraSteps: '추가 이동',
  clickOnlyNormalizedEntropy: '클릭 후보 엔트로피',
  clickOnlyTop2Margin: '클릭 후보 Top-2 margin',
  candidateCount: '후보 수',
  entropyThreshold: '엔트로피 기준값',
}

export function evidenceLabel(key: string): string {
  return Object.hasOwn(EVIDENCE_LABELS, key) ? EVIDENCE_LABELS[key] : key
}

/** `evidence` 값은 `unknown`이다. 타입을 확인한 뒤 문자열로 만든다. */
export function evidenceValue(value: unknown): string {
  if (value === null || value === undefined) return '값 없음'
  if (Array.isArray(value)) return value.map(evidenceValue).join(', ')
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return '표시할 수 없는 값'
  }
}
