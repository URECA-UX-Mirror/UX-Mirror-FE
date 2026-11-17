import { describe, expect, it } from 'vitest'
import { toReferenceBasis, toRun } from '../src/adapters/run.ts'
import { toComparison } from '../src/adapters/comparison.ts'
import { buildComparison } from '../src/mocks/fixtures/comparison.ts'
import { buildRun } from '../src/mocks/fixtures/run.ts'
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
  it('값이 오면 그대로 두고 SITE_MAP mock Run에는 우회 이동이 있다', () => {
    const run = toRun(runOf('run_mock_sitemap'))
    expect(run.summary?.detourMoveCount).toBeGreaterThan(0)
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

  it('goalPathProbability 설명이 기준마다 다르다', () => {
    expect(goalPathProbabilityHint('ALLOWED_PATHS')).not.toBe(goalPathProbabilityHint('SITE_MAP'))
  })
})
