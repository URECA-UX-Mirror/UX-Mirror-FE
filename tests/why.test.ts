import { describe, expect, it } from 'vitest'
import { toReferencePath, toRun } from '../src/adapters/run.ts'
import { toStepList } from '../src/adapters/step.ts'
import type { Candidate, ReferencePath, Run, Step } from '../src/domain/types.ts'
import { explainRun, onPathCandidates } from '../src/features/run-result/why.ts'
import { selectedLabel } from '../src/shared/stepLabel.ts'
import { buildRun, buildSteps } from '../src/mocks/fixtures/run.ts'
import { findRun } from '../src/mocks/store.ts'

// "왜 그랬을까요?"의 답은 서버 값에서 확인되는 것만 말한다 (why.ts)

const FAR_FUTURE = Date.parse('2100-01-01T00:00:00Z')
const PAGE_NAMES: Record<string, string> = { home: '홈', orders: '주문·배송 조회', mypage: '마이페이지', refund: '환불 신청' }
const pageName = (key: string) => PAGE_NAMES[key] ?? '다른 화면'

/** 환불 신청이 목표인 사이트 지도: 홈 → 주문·배송 조회 → 환불 신청 */
const SITE_MAP: ReferencePath = { kind: 'SITE_MAP', distances: { home: 2, orders: 1, mypage: 2, support: null, refund: 0 } }

const baseRun = (): Run => toRun(buildRun(findRun('run_mock_maxsteps')!, FAR_FUTURE))
const baseStep = (): Step => {
  const rec = findRun('run_mock_maxsteps')!
  return toStepList({ runId: rec.runId, count: 1, items: buildSteps(rec, 1) })[0]
}

function run(over: Partial<Run> = {}, summary: Partial<NonNullable<Run['summary']>> = {}): Run {
  const base = baseRun()
  return { ...base, referencePath: SITE_MAP, terminationReason: 'MAX_STEPS_REACHED', ...over, summary: { ...base.summary!, goalReached: false, extraSteps: null, attemptedExtraSteps: null, backCount: 0, ...summary } }
}

/** 후보 [이름, 목적지, 확률]과 고른 후보로 Step 하나를 만든다. `goalPath`는 서버가 준 목표 경로 확률 */
function step(pageKey: string, candidates: [string, string, number][], selected: number | 'BACK', goalPath: number | null, stepId = 1): Step {
  const base = baseStep()
  const list: Candidate[] = candidates.map(([label, href, probability], i) => ({
    ...base.candidates[0], optionId: `o${i}`, label, href, semanticKey: `상단 메뉴>${href}#1`, probability, selected: i === selected,
  }))
  return {
    ...base,
    stepId,
    page: { ...base.page, pageKey },
    candidates: list,
    decision: {
      ...base.decision,
      selectedOptionId: selected === 'BACK' ? 'back' : `o${selected}`,
      selectedActionType: selected === 'BACK' ? 'GO_BACK' : 'CLICK',
      goalPathProbability: goalPath,
    },
  }
}

const HOME: [string, string, number][] = [
  ['쿠폰', '/shop/mypage', 0.46],
  ['이용정보', '/shop/orders', 0.21],
  ['고객센터', '/shop/support', 0.05],
]

describe('목표에 가까워지는 버튼 가려내기', () => {
  it('사이트 지도 기준: 목적지가 목표에 더 가까운 버튼만 고르고, 합이 서버 값과 같아야 한다', () => {
    const first = step('home', HOME, 0, 0.21)
    expect(onPathCandidates(run(), first, 0)?.map((c) => c.label)).toEqual(['이용정보'])
    // 서버 값과 다르면 짚지 않는다
    expect(onPathCandidates(run(), step('home', HOME, 0, 0.5), 0)).toBeNull()
    // 서버가 계산하지 않았으면(null) 짚지 않는다
    expect(onPathCandidates(run(), step('home', HOME, 0, null), 0)).toBeNull()
  })

  it('주소의 쿼리·끝 빗금은 무시하고, 지도에 없는 목적지가 하나라도 있으면 짚지 않는다', () => {
    const query = step('home', [['쿠폰', '/shop/mypage/', 0.5], ['이용정보', '/shop/orders?from=nav', 0.3]], 0, 0.3)
    expect(onPathCandidates(run(), query, 0)?.map((c) => c.label)).toEqual(['이용정보'])
    const outside = step('home', [...HOME, ['이벤트', '/shop/event', 0.1]], 0, 0.21)
    expect(onPathCandidates(run(), outside, 0)).toBeNull()
  })

  it('허용 경로 기준: 첫 화면에서만 다음 화면으로 가는 버튼을 고른다', () => {
    const allowed = run({ referencePath: { kind: 'ALLOWED_PATHS', allowedPaths: [['home', 'orders', 'refund'], ['home', 'mypage', 'refund']] } })
    expect(onPathCandidates(allowed, step('home', HOME, 0, 0.67), 0)?.map((c) => c.label)).toEqual(['쿠폰', '이용정보'])
    expect(onPathCandidates(allowed, step('mypage', [['환불', '/shop/refund', 0.4]], 0, 0.4, 2), 1)).toBeNull()
  })

  it('경로 기준이 없거나 다른 사이트 진단이면 짚지 않는다', () => {
    const first = step('home', HOME, 0, 0.21)
    expect(onPathCandidates(run({ referencePath: null }), first, 0)).toBeNull()
    expect(onPathCandidates(run({ siteId: 'demo' }), first, 0)).toBeNull()
  })

  it('어댑터는 서버의 경로 기준을 그대로 옮기고 모르는 형식은 버린다', () => {
    expect(toReferencePath(null)).toBeNull()
    expect(toReferencePath({ version: 'v', allowedPaths: [['home', 'refund']], shortestAllowedSteps: 1 })).toEqual({ kind: 'ALLOWED_PATHS', allowedPaths: [['home', 'refund']] })
    expect(toReferencePath({ basis: 'SITE_MAP', siteMapVersion: 'v', siteMapHash: 'h', startPageKey: 'home', goalPageKey: 'refund', shortestSteps: 2, distances: { home: 2 } })).toEqual({ kind: 'SITE_MAP', distances: { home: 2 } })
    expect(toReferencePath({ basis: 'NEW_BASIS' } as never)).toBeNull()
  })
})

describe('못 찾은 진단', () => {
  it('첫 화면에서 목표로 가는 버튼 대신 다른 버튼을 눌렀으면 두 버튼의 가능성과 멈춘 이유를 말한다', () => {
    const why = explainRun(run(), [step('home', HOME, 0, 0.21)], pageName)!
    expect(why.headline).toBe("'쿠폰'에 더 끌렸어요")
    expect(why.lines).toEqual([
      "첫 화면에서 '쿠폰'을 눌렀어요. 누를 가능성 46%.",
      "목표로 가는 '이용정보'는 21%였어요.",
      '정해진 클릭 수 안에 찾지 못했어요.',
    ])
    expect(why.first).toBe(true)
    expect(why.step?.page.pageKey).toBe('home')
  })

  it('첫 화면은 맞게 갔고 그 뒤 화면에서 벗어났으면 그 화면을 짚고, 막대도 그 화면 것을 쓴다', () => {
    const steps = [
      step('home', HOME, 1, 0.21),
      step('orders', [['환불 신청', '/shop/refund', 0.3], ['마이페이지', '/shop/mypage', 0.6]], 1, 0.3, 2),
    ]
    const why = explainRun(run(), steps, pageName)!
    expect(why.headline).toBe("'마이페이지'에 더 끌렸어요")
    expect(why.lines.slice(0, 2)).toEqual([
      "주문·배송 조회 화면에서 '마이페이지'를 눌렀어요. 누를 가능성 60%.",
      "목표로 가는 '환불 신청'은 30%였어요.",
    ])
    expect(why.first).toBe(false)
    expect(why.step?.page.pageKey).toBe('orders')
  })

  it('목표로 가는 버튼이 있었는데 이전 화면으로 돌아갔으면 그렇게 말한다', () => {
    const why = explainRun(run(), [step('home', HOME, 'BACK', 0.21)], pageName)!
    expect(why.headline).toBe('가던 길을 되돌아갔어요')
    expect(why.lines.slice(0, 2)).toEqual(['첫 화면에서 이전 화면으로 돌아갔어요.', "목표로 가는 '이용정보'는 21%였어요."])
  })

  it('고른 버튼이 실제로 눌리지 않았으면 "눌렀어요"가 아니라 "누르려 했어요"라고 한다', () => {
    const first = step('home', HOME, 0, 0.21)
    const failed = { ...first, action: { ...first.action, executed: false } }
    const why = explainRun(run(), [failed], pageName)!
    expect(why.lines[0]).toBe("첫 화면에서 '쿠폰'을 누르려 했어요. 누를 가능성 46%.")
    const fallback = explainRun(run({ referencePath: null }), [{ ...failed, decision: { ...failed.decision, goalPathProbability: null } }], pageName)!
    expect(fallback.lines).toEqual(["첫 화면에서는 '쿠폰'을 누르려 했어요. 누를 가능성 46%."])
  })

  it('목표로 가는 버튼의 가능성이 더 높았는데 다른 것을 눌렀으면 "더 끌렸다"고 하지 않는다', () => {
    const why = explainRun(run(), [step('home', HOME.map(([l, h], i) => [l, h, [0.2, 0.5, 0.05][i]] as [string, string, number]), 0, 0.5)], pageName)!
    expect(why.headline).toBe("'쿠폰'을 눌렀어요")
  })

  it('벗어난 화면을 가려낼 수 없으면 원인을 지어내지 않고, 멈춘 이유와 첫 화면에서 누른 것만 말한다', () => {
    const why = explainRun(run({ referencePath: null }), [step('home', HOME, 0, null)], pageName)!
    expect(why.headline).toBe('정해진 클릭 수 안에 찾지 못했어요')
    expect(why.lines).toEqual(["첫 화면에서는 '쿠폰'을 눌렀어요. 누를 가능성 46%."])
    expect(why.lines.join(' ')).not.toContain('목표로 가는')
    expect(why.first).toBe(true)
  })

  it('클릭 기록이 없으면 멈춘 이유만 말하고 막대는 없다', () => {
    const why = explainRun(run({ terminationReason: 'REVISIT_LIMIT_REACHED' }), [], pageName)!
    expect(why).toEqual({ headline: '같은 화면을 계속 다시 찾아가서 멈췄어요', lines: [], step: null, first: false })
  })
})

describe('찾은 진단', () => {
  // ①의 "N번 만에"(stepCount)와 같은 기준인 attemptedExtraSteps를 쓴다. extraSteps(성공한 이동만)는 일부러 다른 값으로 둔다
  const reached = (attemptedExtraSteps: number | null, backCount = 0) =>
    run({ terminationReason: 'GOAL_VERIFIED' }, { goalReached: true, attemptedExtraSteps, backCount, extraSteps: 7 })

  it('더 누른 횟수가 0이면 헤매지 않았다고 한다', () => {
    const why = explainRun(reached(0), [step('home', HOME, 1, 0.21)], pageName)!
    expect(why.headline).toBe('헤매지 않았어요')
    expect(why.lines).toEqual(['돌아가지 않고 바로 찾았어요.'])
  })

  it('더 눌렀으면 몇 번인지와, 가려낼 수 있으면 벗어난 화면을 말한다', () => {
    const why = explainRun(reached(2), [step('home', HOME, 0, 0.21)], pageName)!
    expect(why.headline).toBe('2번 더 눌렀어요')
    expect(why.lines).toEqual([
      '가장 짧은 길보다 더 눌러서 도착했어요.',
      "첫 화면에서 '쿠폰'을 눌렀어요. 누를 가능성 46%.",
      "목표로 가는 '이용정보'는 21%였어요.",
    ])
  })

  it('더 누르지는 않았어도 되돌아간 적이 있으면 헤매지 않았다고 하지 않는다', () => {
    const why = explainRun(reached(0, 1), [step('home', HOME, 1, 0.21)], pageName)!
    expect(why.headline).toBe('1번 되돌아갔어요')
    expect(why.lines.join(' ')).not.toContain('바로 찾았어요')
  })

  it('가장 짧은 길을 모르면(값 없음) 돌아갔는지 말하지 않는다', () => {
    const why = explainRun(reached(null), [step('home', HOME, 1, null)], pageName)!
    expect(why.headline).toBe('막힌 곳은 없었어요')
    expect(why.lines).toEqual([])
  })
})

it('끝내지 못한 진단(무효·오류·도달 여부 없음)은 이유를 말하지 않는다', () => {
  const first = [step('home', HOME, 0, 0.21)]
  expect(explainRun(run({ validity: 'INVALID' }), first, pageName)).toBeNull()
  expect(explainRun(run({ status: 'ERROR' }), first, pageName)).toBeNull()
  expect(explainRun({ ...run(), summary: null }, first, pageName)).toBeNull()
})

it('고른 후보를 찾지 못해도 선택지 ID를 화면 말로 쓰지 않는다', () => {
  const first = step('home', HOME, 0, 0.21)
  expect(selectedLabel(first)).toBe('쿠폰')
  expect(selectedLabel({ ...first, decision: { ...first.decision, selectedOptionId: 'option_99' } })).toBe('알 수 없는 버튼')
})
