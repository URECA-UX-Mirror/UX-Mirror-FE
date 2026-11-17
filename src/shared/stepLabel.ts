import type { Step } from '../domain/types.ts'

const pad2 = (value: number) => String(value).padStart(2, '0')

/** `HH:MM:SS`(브라우저 시간대). 해석할 수 없는 값은 `-` */
export function stepTime(timestamp: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime())
    ? '-'
    : `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

/** `YYYY.MM.DD HH:MM`(브라우저 시간대). 해석할 수 없는 값은 `-` */
export function formatDateTime(timestamp: string | null): string {
  if (timestamp === null) return '-'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 그 Step에서 모델이 고른 후보의 이름. GO_BACK은 후보가 아니라서 따로 쓴다 */
export function selectedLabel(step: Step): string {
  if (step.decision.selectedActionType === 'GO_BACK') return '이전 화면으로 돌아가기'
  return (
    step.candidates.find((c) => c.optionId === step.decision.selectedOptionId)?.label ??
    step.decision.selectedOptionId
  )
}
