import type { Candidate, Run, Step } from '../../domain/types.ts'
import { eulOf, eunOf, quote } from '../../shared/hangul.ts'
import { stopReasonLabel } from '../../shared/runLabels.ts'

/** AI가 이름을 바꿀 수 있는 버튼 하나: 상단 메뉴 '이용정보' 자리 (BE `uxm/label_edit.py` `EDITABLE_KEY`) */
export const EDITABLE_KEY = '상단 메뉴>/shop/orders#1'

/** 서버 값(`goalPathProbability`)과 다시 더한 값이 이만큼 넘게 다르면 버튼을 짚지 않는다 */
const TOLERANCE = 0.01

export interface Why {
  /** 큰 답 한 줄 */
  headline: string
  /** 덧붙이는 문장. 한 줄에 한 가지 */
  lines: string[]
  /** 막대로 보일 화면. 길에서 벗어난 화면을 찾았으면 그 화면, 아니면 첫 화면 */
  step: Step | null
  /** `step`이 첫 화면인지 */
  first: boolean
}

const percent = (p: number) => `${Math.round(p * 100)}%`

/** BE `uxm/browser.py` `page_key`와 같은 규칙: `/shop/orders?x=1` → `orders`. MORO MARKET 주소가 아니면 `null` */
function pageKeyOfHref(href: string): string | null {
  let path: string
  try {
    path = new URL(href, 'http://local').pathname.replace(/\/+$/, '')
  } catch {
    return null
  }
  return path.startsWith('/shop/') ? path.slice(path.lastIndexOf('/') + 1) : null
}

/**
 * 이 화면에서 목표에 가까워지는 버튼들. 서버가 `goalPathProbability`를 더할 때와 같은 규칙으로 고른다
 * (BE `uxm/agent.py` `_goal_path_probability`).
 * - 사이트 지도 기준: 목적지 화면의 거리가 지금 화면보다 짧은 버튼
 * - 허용 경로 기준: 첫 화면에서만, 허용 경로의 다음 화면으로 가는 버튼 (그 뒤 화면은 지나온 길을 알아야 해서 가리지 않는다)
 * 고른 버튼들의 확률 합이 서버 값과 다르면 `null`이다. 다른 사이트 진단도 `null`이다 (화면 이름 규칙이 다르다).
 */
export function onPathCandidates(run: Run, step: Step, index: number): Candidate[] | null {
  const reference = run.referencePath
  const expected = step.decision.goalPathProbability
  if (!reference || expected === null || run.siteId) return null
  let picked: Candidate[]
  if (reference.kind === 'SITE_MAP') {
    const here = reference.distances[step.page.pageKey]
    if (here === undefined) return null
    picked = []
    for (const candidate of step.candidates) {
      const key = pageKeyOfHref(candidate.href)
      const there = key === null ? undefined : reference.distances[key]
      if (there === undefined) return null
      if ((there ?? Infinity) < (here ?? Infinity)) picked.push(candidate)
    }
  } else {
    if (index !== 0) return null
    const next = new Set(reference.allowedPaths.filter((p) => p.length > 1 && p[0] === step.page.pageKey).map((p) => p[1]))
    picked = step.candidates.filter((c) => {
      const key = pageKeyOfHref(c.href)
      return key !== null && next.has(key)
    })
  }
  const sum = picked.reduce((total, c) => total + c.probability, 0)
  return Math.abs(sum - expected) <= TOLERANCE ? picked : null
}

const best = (candidates: Candidate[]) => candidates.reduce((a, b) => (b.probability > a.probability ? b : a))

interface Stray {
  step: Step
  index: number
  /** 목표에 가까워지는 버튼 중 누를 가능성이 가장 높았던 것 */
  toward: Candidate
  /** 실제로 누른 버튼. 이전 화면으로 돌아갔으면 `null` */
  chosen: Candidate | null
}

/** 목표에 가까워지는 버튼이 있었는데 다른 것을 고른 첫 화면. 가려낼 수 없으면 `null` */
function firstStray(run: Run, steps: Step[]): Stray | null {
  for (const [index, step] of steps.entries()) {
    const onPath = onPathCandidates(run, step, index)
    if (!onPath?.length) continue
    const back = step.decision.selectedActionType === 'GO_BACK'
    const chosen = back ? null : step.candidates.find((c) => c.optionId === step.decision.selectedOptionId) ?? null
    if (!back && !chosen) continue
    if (chosen && onPath.includes(chosen)) continue
    return { step, index, toward: best(onPath), chosen }
  }
  return null
}

/** 고른 버튼이 실제로 눌렸는지에 따라 말을 달리한다 (`action.executed`) */
const pressed = (step: Step) => (step.action.executed ? '눌렀어요' : '누르려 했어요')

function strayLines(stray: Stray, pageName: (pageKey: string) => string): string[] {
  const where = stray.index === 0 ? '첫 화면에서' : `${pageName(stray.step.page.pageKey)} 화면에서`
  const toward = quote(stray.toward.label)
  const towardLine = `목표로 가는 ${toward}${eunOf(stray.toward.label)} ${percent(stray.toward.probability)}였어요.`
  if (!stray.chosen) return [`${where} 이전 화면으로 돌아갔어요.`, towardLine]
  const chosen = quote(stray.chosen.label)
  return [`${where} ${chosen}${eulOf(stray.chosen.label)} ${pressed(stray.step)}. 누를 가능성 ${percent(stray.chosen.probability)}.`, towardLine]
}

function strayHeadline(stray: Stray): string {
  if (!stray.chosen) return '가던 길을 되돌아갔어요'
  return stray.chosen.probability > stray.toward.probability
    ? `${quote(stray.chosen.label)}에 더 끌렸어요`
    : `${quote(stray.chosen.label)}${eulOf(stray.chosen.label)} ${pressed(stray.step)}`
}

/** 길에서 벗어난 화면을 짚지 못할 때: 첫 화면에서 실제로 누른 것만 말한다 */
function firstClickLine(step: Step | undefined): string[] {
  if (!step || step.decision.selectedActionType === 'GO_BACK') return []
  const chosen = step.candidates.find((c) => c.optionId === step.decision.selectedOptionId)
  return chosen ? [`첫 화면에서는 ${quote(chosen.label)}${eulOf(chosen.label)} ${pressed(step)}. 누를 가능성 ${percent(chosen.probability)}.`] : []
}

/**
 * "왜 그랬을까요?"의 답. 서버가 준 값에서 확인되는 것만 말한다:
 * 멈춘 이유(`terminationReason`), 더 누른 횟수(`summary.attemptedExtraSteps`)·되돌아간 횟수(`backCount`), 그리고
 * 목표에 가까워지는 버튼(`onPathCandidates`)이 있었는데 다른 것을 고른 첫 화면.
 * 끝내지 못한 진단(무효·오류)은 `null`이다.
 */
export function explainRun(run: Run, steps: Step[], pageName: (pageKey: string) => string): Why | null {
  const reached = run.summary?.goalReached
  if (typeof reached !== 'boolean' || run.validity === 'INVALID' || run.status === 'ERROR') return null
  const stray = firstStray(run, steps)
  const step = stray?.step ?? steps[0] ?? null
  const shown = { step, first: step !== null && step === steps[0] }

  if (reached) {
    // ①의 "N번 만에"와 같은 기준(전체 클릭 수 − 가장 짧은 길)으로 센다. `extraSteps`는 성공한 이동만 세어 서로 어긋난다
    const extra = run.summary?.attemptedExtraSteps ?? null
    const backs = run.summary?.backCount ?? 0
    if (extra === null) return { headline: '막힌 곳은 없었어요', lines: [], ...shown }
    if (extra <= 0) {
      return backs === 0
        ? { headline: '헤매지 않았어요', lines: ['돌아가지 않고 바로 찾았어요.'], ...shown }
        : { headline: `${backs}번 되돌아갔어요`, lines: stray ? strayLines(stray, pageName) : [], ...shown }
    }
    return {
      headline: `${extra}번 더 눌렀어요`,
      lines: ['가장 짧은 길보다 더 눌러서 도착했어요.', ...(stray ? strayLines(stray, pageName) : [])],
      ...shown,
    }
  }

  const stop = stopReasonLabel(run.terminationReason)
  const stopLine = stop ? [`${stop}.`] : []
  if (stray) return { headline: strayHeadline(stray), lines: [...strayLines(stray, pageName), ...stopLine], ...shown }
  return { headline: stop ?? '끝까지 가지 못했어요', lines: firstClickLine(steps[0]), ...shown }
}
