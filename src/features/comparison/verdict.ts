import type { Comparison, RunOutcome } from '../../domain/types.ts'
import { SIDE_NAMES } from './labels.ts'

/** 끝까지 둘러본 상태. 오류나 모르는 상태는 결과를 견주지 않는다 */
const FINISHED = ['SUCCESS', 'BLOCKED', 'MAX_STEPS', 'TIMEOUT']

/** 한쪽 결과 한 줄. 예: `3번 만에 도착`, `못 찾음` */
export function outcomeText(outcome: RunOutcome): string {
  if (outcome.goalReached) return `${outcome.stepCount}번 만에 도착`
  if (!FINISHED.includes(outcome.status)) return '중간에 멈춤'
  return '못 찾음'
}

/**
 * 두 결과를 한 문장으로 말한다. 서버가 준 도착 여부와 단계 수만 견준다.
 * 설정이 다르거나 한쪽이 끝까지 둘러보지 못했으면 말하지 않는다(`null`).
 */
export function verdictText(comparison: Pick<Comparison, 'conditionsMatched' | 'runComparison'>): string | null {
  if (!comparison.conditionsMatched) return null
  const { before, after } = comparison.runComparison
  if (!FINISHED.includes(before.status) || !FINISHED.includes(after.status)) return null
  if (!before.goalReached && !after.goalReached) return '둘 다 못 찾았어요'
  if (!before.goalReached) return `${SIDE_NAMES.after}에서만 찾았어요`
  if (!after.goalReached) return `${SIDE_NAMES.before}에서만 찾았어요`
  if (after.stepCount < before.stepCount) return `${SIDE_NAMES.after}에서 더 빨리 찾았어요`
  if (after.stepCount > before.stepCount) return `${SIDE_NAMES.before}에서 더 빨리 찾았어요`
  return '차이가 없어요'
}
