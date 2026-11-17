import { expect, it } from 'vitest'
import { buildRun } from '../src/mocks/fixtures/run.ts'
import { GOAL_PAGES } from '../src/features/new-analysis/constants.ts'
import { allRuns } from '../src/mocks/store.ts'

// MOCK의 goalReached는 시나리오가 끝났는지로 정해진다. 저장된 성공 조건(verification)과 어긋나지 않게,
// 목표에 도달한 시드는 마지막 방문 화면이 성공 조건의 도착 화면이어야 한다 (FE #27 리뷰).
const FAR_FUTURE = Date.parse('2100-01-01T00:00:00Z')

it('목표에 도달한 MOCK 시드는 마지막 방문 화면이 성공 조건의 도착 화면이다', () => {
  const reached = allRuns().map((rec) => buildRun(rec, FAR_FUTURE)).filter((run) => run.summary?.goalReached)
  expect(reached.length).toBeGreaterThan(0)
  for (const run of reached) {
    const last = run.summary!.path.at(-1)!
    expect([run.runId, last.path]).toEqual([run.runId, run.verification!.path])
  }
})

it('직접 입력 시드의 성공 조건 글자는 도착 화면의 실제 제목과 같다', () => {
  const direct = allRuns().map((rec) => buildRun(rec, FAR_FUTURE)).filter((run) => run.goalId === null)
  expect(direct.length).toBeGreaterThan(0)
  for (const run of direct) {
    const page = GOAL_PAGES.find((item) => item.path === run.verification!.path)
    expect([run.runId, run.verification!.text]).toEqual([run.runId, page?.text])
  }
})
