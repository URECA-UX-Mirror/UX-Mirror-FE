import { describe, expect, it } from 'vitest'
import { toReferenceBasis, toRun } from '../src/adapters/run.ts'
import { toComparison } from '../src/adapters/comparison.ts'
import { buildComparison } from '../src/mocks/fixtures/comparison.ts'
import { buildRun, buildSteps } from '../src/mocks/fixtures/run.ts'
import { countDetourMoves, siteMapDistances } from '../src/mocks/fixtures/siteMap.ts'
import { findRun } from '../src/mocks/store.ts'
import {
  goalPathProbabilityHint,
  pathMetricNames,
  referenceBasisLabel,
} from '../src/domain/referenceBasis.ts'

const FAR_FUTURE = Date.parse('2027-01-01T00:00:00+09:00')

function runOf(runId: string) {
  const rec = findRun(runId)
  if (!rec) throw new Error(`mock Run이 없습니다: ${runId}`)
  return buildRun(rec, FAR_FUTURE)
}

describe('경로 지표 기준(basis) 변환', () => {
  it('basis가 없는 설정은 ALLOWED_PATHS로 해석한다', () => {
    const dto = runOf('run_mock_legacy_basis')
    expect(dto.referencePathConfig).not.toBeNull()
    expect(dto.referencePathConfig).not.toHaveProperty('basis')
    expect(toRun(dto).referenceBasis).toBe('ALLOWED_PATHS')
  })

  it('referencePathConfig 필드 자체가 없는 과거 Run도 ALLOWED_PATHS다', () => {
    const dto = runOf('run_mock_done_before')
    delete dto.referencePathConfig
    expect(toRun(dto).referenceBasis).toBe('ALLOWED_PATHS')
  })

  it('명시적 null만 기준 없음이다', () => {
    expect(toRun(runOf('run_mock_mapfail')).referenceBasis).toBeNull()
    expect(toRun(runOf('run_mock_direct_before')).referenceBasis).toBeNull()
    expect(toReferenceBasis(null)).toBeNull()
    expect(toReferenceBasis(undefined)).toBe('ALLOWED_PATHS')
  })

  it('SITE_MAP 설정은 SITE_MAP으로 읽고 기존 preset은 ALLOWED_PATHS다', () => {
    expect(toRun(runOf('run_mock_sitemap')).referenceBasis).toBe('SITE_MAP')
    expect(toRun(runOf('run_mock_done_before')).referenceBasis).toBe('ALLOWED_PATHS')
  })
})

describe('detourMoveCount 변환', () => {
  it('값이 오면 그대로 둔다(홈→마이페이지는 거리가 줄지 않아 우회 이동 1회)', () => {
    const run = toRun(runOf('run_mock_sitemap'))
    expect(run.summary?.detourMoveCount).toBe(1)
  })

  it('BACK만 있는 이동은 우회 이동으로 세지 않는다', () => {
    const distances = siteMapDistances('orders')
    const backOnly = [{ to: 'home' as const, back: true }, { to: 'home' as const, back: true }]
    expect(countDetourMoves(backOnly, distances)).toBe(0)
    // 목표에 가까워지는 CLICK(home→orders) 뒤의 BACK도 세지 않는다
    expect(countDetourMoves([{ to: 'orders', back: false }, { to: 'home', back: true }], distances)).toBe(0)
    // 거리가 줄지 않는 CLICK은 센다
    expect(countDetourMoves([{ to: 'mypage', back: false }], distances)).toBe(1)
  })
})

describe('SITE_MAP 설정(설계 v2.1 4.1) 변환', () => {
  it('실제 백엔드 형식(도달 불가 화면은 null)을 그대로 읽는다', () => {
    const dto = runOf('run_mock_sitemap')
    dto.referencePathConfig = {
      basis: 'SITE_MAP',
      siteMapVersion: 'v1',
      siteMapHash: 'sha256:abc',
      startPageKey: 'home',
      goalPageKey: 'orders',
      shortestSteps: 1,
      distances: { home: 1, orders: 0, support: null },
    }
    const run = toRun(dto)
    expect(run.referenceBasis).toBe('SITE_MAP')
    expect(dto.referencePathConfig.distances.support).toBeNull()
  })

  it('mock은 설계의 필드를 쓴다', () => {
    const config = runOf('run_mock_sitemap').referencePathConfig
    expect(config).toMatchObject({
      basis: 'SITE_MAP',
      startPageKey: 'home',
      goalPageKey: 'orders',
      shortestSteps: 1,
    })
    expect(config).not.toHaveProperty('version')
  })

  it('직접 입력한 목표에도 SITE_MAP이 유지되고 goalPathProbability는 거리가 줄어드는 후보만 합한다', () => {
    const rec = findRun('run_mock_sitemap')!
    expect(rec.goalId).toBeNull()
    const [first] = buildSteps(rec, 1)
    // 홈: orders 후보(거리 0)만 목표에 가까워진다. 허용 경로용 onGoalPath(orders+mypage)와 다르다
    const toOrders = first.candidateSet.candidates
      .filter((c) => c.href === '/shop/orders')
      .reduce((sum, c) => sum + c.probability, 0)
    expect(first.decision.goalPathProbability).toBeCloseTo(toOrders, 3)
  })

  it('필드가 없으면 0이 아니라 null이다', () => {
    const dto = runOf('run_mock_legacy_basis')
    expect(dto.summary).not.toHaveProperty('detourMoveCount')
    expect(toRun(dto).summary?.detourMoveCount).toBeNull()
  })

  it('지도 오류 Run은 경로 기반 지표가 모두 null이다', () => {
    const summary = toRun(runOf('run_mock_mapfail')).summary
    expect(summary?.extraSteps).toBeNull()
    expect(summary?.detourMoveCount).toBeNull()
  })
})

describe('비교 결과의 detourMoveCount 변환', () => {
  const dtoOf = (beforeId: string, afterId: string) =>
    buildComparison(findRun(beforeId)!, findRun(afterId)!, true)

  it('있으면 그대로 두고 없으면 null이다', () => {
    const dto = dtoOf('run_mock_sitemap', 'run_mock_done_after')
    expect(dto.runComparison.before.detourMoveCount).toBeDefined()
    const { before, after } = toComparison(dto).runComparison
    expect(before.detourMoveCount).toBeGreaterThan(0)
    expect(after.detourMoveCount).toBeNull()
  })

  it('DTO에 필드가 생략돼도 0이 아니라 null로 읽는다', () => {
    const dto = dtoOf('run_mock_legacy_basis', 'run_mock_done_after')
    expect(dto.runComparison.before).not.toHaveProperty('detourMoveCount')
    expect(toComparison(dto).runComparison.before.detourMoveCount).toBeNull()
  })
})

describe('기준별 표시 문구', () => {
  it('기준 이름을 한 곳에서 정한다', () => {
    expect(referenceBasisLabel('ALLOWED_PATHS')).toBe('허용 경로')
    expect(referenceBasisLabel('SITE_MAP')).toBe('사이트 지도')
    expect(referenceBasisLabel(null)).toBe('기준 없음')
    expect(referenceBasisLabel('FUTURE_BASIS')).toBe('FUTURE_BASIS')
  })

  it('우회 이동 이름은 사이트 지도 기준에만 있다', () => {
    expect(pathMetricNames('SITE_MAP')?.detourMoveCount).toBe('우회 이동')
    expect(pathMetricNames('ALLOWED_PATHS')?.detourMoveCount).toBeNull()
    expect(pathMetricNames('SITE_MAP')?.extraSteps).toBe('최단 경로 대비 추가 단계')
    expect(pathMetricNames(null)).toBeNull()
  })

  it('허용 경로는 기존 이름을, 사이트 지도는 최단 경로 대비 이름을 쓴다', () => {
    expect(pathMetricNames('ALLOWED_PATHS')).toEqual({
      extraSteps: '추가 이동(extraSteps)',
      extraNavigationCost: '추가 이동 비용',
      detourMoveCount: null,
    })
    expect(pathMetricNames('SITE_MAP')).toEqual({
      extraSteps: '최단 경로 대비 추가 단계',
      extraNavigationCost: '최단 경로 대비 추가 이동 비용',
      detourMoveCount: '우회 이동',
    })
  })

  it('모르는 기준은 허용 경로 이름을 쓴다', () => {
    expect(pathMetricNames('FUTURE_BASIS')).toEqual(pathMetricNames('ALLOWED_PATHS'))
  })

  it('goalPathProbability 설명이 기준마다 다르다', () => {
    expect(goalPathProbabilityHint('ALLOWED_PATHS')).not.toBe(goalPathProbabilityHint('SITE_MAP'))
  })
})
