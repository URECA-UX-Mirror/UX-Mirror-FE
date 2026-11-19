import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { formatScore, formatScoreDelta, formatScoreMagnitude } from '../src/domain/improvementScore.ts'

// 자동 개선 데이터 타입·검증기 (FE #77). 형식 정본은 공식 결과 tests/fixtures/improvements/imp-1119.json과 개선 채택 픽스처 tests/fixtures/improvement.improved.json

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const read = (path: string): Json =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf-8'))

const loadImproved = () => read('./fixtures/improvement.improved.json')
const noImprovement = () => read('fixtures/improvements/imp-1119.json')

/** 점 경로(`a.b[0].c`)의 값을 지운 사본. 마지막 키를 `delete`한다 */
function without(path: string, source: Json = loadImproved()): Json {
  const keys = path.split('.')
  let node: any = source // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const key of keys.slice(0, -1)) {
    const match = /^(\w+)\[(\d+)\]$/.exec(key)
    node = match ? node[match[1]][Number(match[2])] : node[key]
  }
  delete node[keys[keys.length - 1]]
  return source
}

const AREAS = ['report', 'official', 'rounds', 'verification'] as const

function okAreas(view: ReturnType<typeof toImprovementView>) {
  return AREAS.filter((name) => view[name].ok)
}

describe('개선 채택 데이터 통과', () => {
  it('개선 채택 JSON 전체가 네 영역 모두 ok다', () => {
    const view = toImprovementView(loadImproved())
    expect(okAreas(view)).toEqual([...AREAS])
    expect(view.plan?.mainGoal?.goalKey).toBe('S1')
    expect(view.stop?.reason).toBe('MAX_ROUNDS')
    expect(view.limitations).toContain('Zoro-1')
  })

  it('IMPROVED 요약은 개선 전후·변화량을 그대로 읽는다', () => {
    const report = toImprovementView(loadImproved()).report
    if (!report.ok) throw new Error(report.reason)
    expect(report.data.result).toBe('IMPROVED')
    expect(report.data.afterLabel).toBe('주문내역')
    expect(report.data.main).toMatchObject({ goalKey: 'S1', before: 0.385, after: 0.701, delta: 0.316 })
    expect(report.data.guards.map((guard) => guard.delta)).toEqual([0.132, 0.132, -0.008])
  })

  it('verification NOT_RUN·FAILED는 상태 그대로 ok이고 summary·official은 그대로다', () => {
    for (const name of ['not-run', 'failed']) {
      const improved = loadImproved()
      improved.verification = read(`./fixtures/improvement.verification-${name}.json`)
      const view = toImprovementView(improved)
      expect(okAreas(view)).toEqual([...AREAS])
    }
    const notRun = loadImproved()
    notRun.verification = read('./fixtures/improvement.verification-not-run.json')
    const verification = toImprovementView(notRun).verification
    expect(verification.ok && verification.data).toMatchObject({ status: 'NOT_RUN', error: null, pairs: [] })

    const failed = loadImproved()
    failed.verification = read('./fixtures/improvement.verification-failed.json')
    const failedView = toImprovementView(failed).verification
    if (!failedView.ok) throw new Error(failedView.reason)
    expect(failedView.data.status).toBe('FAILED')
    expect(failedView.data.error?.code).toBe('MODEL_UNAVAILABLE')
    // Run을 만들지 못한 쌍은 before·after가 null이다
    expect(failedView.data.pairs[1]).toMatchObject({ goalKey: 'S4', before: null, after: null })
    expect(failedView.data.pairs[0].after).toMatchObject({ status: 'ERROR', validity: 'INVALID' })
  })
})

describe('NO_IMPROVEMENT', () => {
  it('after·delta가 null로 유지되고 오류가 되지 않는다', () => {
    const improved = loadImproved()
    const { summary, official } = noImprovement()
    improved.summary = summary
    improved.official = official
    const view = toImprovementView(improved)
    expect(okAreas(view)).toEqual([...AREAS])

    const report = view.report
    if (!report.ok) throw new Error(report.reason)
    expect(report.data.result).toBe('NO_IMPROVEMENT')
    expect(report.data.afterLabel).toBeNull()
    expect(report.data.afterSource).toBeNull()
    expect(report.data.main).toMatchObject({ before: 0.401647, after: null, delta: null })
    for (const guard of report.data.guards) {
      expect(guard.after).toBeNull()
      expect(guard.delta).toBeNull()
    }
    // official이 null이면 공식 평가 결과 없음이며 오류가 아니다
    expect(view.official).toEqual({ ok: true, data: null })
  })

  it('IMPROVED이면 after·delta·afterLabel이 필수다', () => {
    for (const path of [
      'summary.afterLabel',
      'summary.main.after',
      'summary.main.delta',
      'summary.guards[0].after',
      'summary.guards[2].delta',
    ]) {
      expect(okAreas(toImprovementView(without(path))), path).toEqual(['official', 'rounds', 'verification'])
    }
  })
})

describe('필수 필드를 하나씩 빼면 해당 영역만 오류', () => {
  const cases: [string, (typeof AREAS)[number]][] = [
    ['schemaVersion', 'report'],
    ['improvementId', 'report'],
    ['status', 'report'],
    ['summary.result', 'report'],
    ['summary.beforeLabel', 'report'],
    ['summary.main.before', 'report'],
    ['summary.guards[1].before', 'report'],
    ['official.label', 'official'],
    ['official.scores.mainScore', 'official'],
    ['official.scores.guardScores', 'official'],
    ['rounds[0].round', 'rounds'],
    ['rounds[0].candidates[0].candidateId', 'rounds'],
    ['rounds[1].candidates[0].label', 'rounds'],
    ['rounds[2].candidates[1].decision', 'rounds'],
    ['verification.status', 'verification'],
    ['verification.pairs', 'verification'],
  ]

  it.each(cases)('%s 제거 → %s만 오류', (path, broken) => {
    const view = toImprovementView(without(path))
    const result = view[broken]
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain(path.split('.').pop()!.replace(/\[\d+\]/, ''))
    expect(okAreas(view)).toEqual(AREAS.filter((name) => name !== broken))
  })

  it('`_required`에 없는 goalKey가 빠져도 영역은 ok이고 null로 읽는다', () => {
    const improved = loadImproved()
    delete improved.summary.main.goalKey
    delete improved.summary.guards[0].goalKey
    delete improved.verification.pairs[0].goalKey
    const view = toImprovementView(improved)
    expect(okAreas(view)).toEqual([...AREAS])
    expect(view.report.ok && view.report.data.main.goalKey).toBeNull()
    expect(view.verification.ok && view.verification.data.pairs[0].goalKey).toBeNull()
  })

  it('summary.main.before 제거 시 official·rounds·verification은 ok다', () => {
    const view = toImprovementView(without('summary.main.before'))
    expect(view.report.ok).toBe(false)
    expect(view.official.ok && view.rounds.ok && view.verification.ok).toBe(true)
  })

  it('형식이 다르면 오류다(숫자 자리에 문자열, 지원하지 않는 schemaVersion)', () => {
    const improved = loadImproved()
    improved.summary.main.before = '0.385'
    expect(toImprovementView(improved).report.ok).toBe(false)

    const other = loadImproved()
    other.schemaVersion = 'improvement-v2'
    expect(toImprovementView(other).report.ok).toBe(false)
    expect(okAreas(toImprovementView(other))).toEqual(['official', 'rounds', 'verification'])
  })

  it('official 키가 아예 없으면 오류이고 null이면 값 없음이다', () => {
    expect(toImprovementView(without('official')).official.ok).toBe(false)
    const improved = loadImproved()
    improved.official = null
    expect(toImprovementView(improved).official).toEqual({ ok: true, data: null })
  })

  it('JSON이 객체가 아니면 네 영역이 모두 오류다', () => {
    for (const input of [null, 'x', [], 3]) {
      expect(okAreas(toImprovementView(input))).toEqual([])
    }
  })
})

describe('null 보존·모르는 값', () => {
  it('candidates[].mainScore=null이 0점으로 바뀌지 않는다', () => {
    const rounds = toImprovementView(loadImproved()).rounds
    if (!rounds.ok) throw new Error(rounds.reason)
    const skipped = rounds.data[0].candidates.find((c) => c.candidateId === 'R1-A3')!
    const failed = rounds.data[0].candidates.find((c) => c.candidateId === 'R1-A4')!
    expect(skipped).toMatchObject({ evaluationStatus: 'SKIPPED', mainScore: null, guardScores: null })
    expect(failed).toMatchObject({ evaluationStatus: 'FAILED', mainScore: null, guardScores: null })
    expect(skipped.layoutReasons).toEqual(['LABEL_OVERFLOW'])
    // 점수가 있는 후보는 그대로
    expect(rounds.data[0].candidates[0].mainScore).toBe(0.512)
    // 채택이 없는 회차는 adopted가 null
    expect(rounds.data[2].adopted).toBeNull()
    expect(rounds.data[0].adopted).toBe('R1-H4')
  })

  it('mainScore가 숫자가 아니면 0이 아니라 null이다', () => {
    const improved = loadImproved()
    improved.rounds[0].candidates[0].mainScore = 'oops'
    const rounds = toImprovementView(improved).rounds
    expect(rounds.ok && rounds.data[0].candidates[0].mainScore).toBeNull()
  })

  it('verification.pairs[].before·after가 null이면 null로 읽는다', () => {
    const improved = loadImproved()
    improved.verification.pairs[0].before = null
    delete improved.verification.pairs[0].after
    const verification = toImprovementView(improved).verification
    expect(verification.ok && verification.data.pairs[0]).toMatchObject({ before: null, after: null })
  })

  it('모르는 enum 값은 오류가 아니라 원문으로 남는다', () => {
    const improved = loadImproved()
    improved.summary.result = 'PARTIAL'
    improved.summary.afterSource = 'ROBOT'
    improved.verification.status = 'QUEUED'
    improved.rounds[0].candidates[0].evaluationStatus = 'PAUSED'
    improved.rounds[0].candidates[0].decision = 'DEFERRED'
    improved.rounds[0].candidates[0].source = 'COACH'
    const view = toImprovementView(improved)
    expect(okAreas(view)).toEqual([...AREAS])

    const report = view.report
    expect(report.ok && report.data.result).toBe('PARTIAL')
    expect(report.ok && report.data.afterSource).toBe('ROBOT')
    expect(view.verification.ok && view.verification.data.status).toBe('QUEUED')
    const candidate = view.rounds.ok && view.rounds.data[0].candidates[0]
    expect(candidate).toMatchObject({ evaluationStatus: 'PAUSED', decision: 'DEFERRED', source: 'COACH' })
  })
})

describe('점수 표시 헬퍼', () => {
  it('0~1 점수를 %로 바꾼다', () => {
    expect(formatScore(0.385)).toBe('38.5%')
    expect(formatScore(0.701)).toBe('70.1%')
    expect(formatScore(0)).toBe('0.0%')
    expect(formatScore(1)).toBe('100.0%')
    expect(formatScore(null)).toBe('값 없음')
  })

  it('변화량을 %p로 바꾸고 양수에만 +를 붙인다(음수·0 포함)', () => {
    expect(formatScoreDelta(0.316)).toBe('+31.6%p')
    expect(formatScoreDelta(-0.008)).toBe('-0.8%p')
    expect(formatScoreDelta(-0.02)).toBe('-2.0%p')
    expect(formatScoreDelta(0)).toBe('0.0%p')
    // 반올림하면 0이 되는 값에 `-0.0`이 붙지 않는다
    expect(formatScoreDelta(-0.0004)).toBe('0.0%p')
    expect(formatScoreDelta(null)).toBe('값 없음')
  })

  it('차이의 크기는 부호 없이 %p로 바꾼다', () => {
    expect(formatScoreMagnitude(0.006)).toBe('0.6%p')
    expect(formatScoreMagnitude(-0.006)).toBe('0.6%p')
    expect(formatScoreMagnitude(null)).toBe('값 없음')
  })
})
