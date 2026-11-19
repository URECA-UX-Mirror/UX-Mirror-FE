import type { Open, Run, RunListItem, Site } from './types.ts'

/** `mode`가 `SCENARIO`인 Run만 시나리오 Run이다. `null`이거나 필드가 없던 Run은 버전 비교 Run이다(임시, OI-11). */
export function isScenarioRun(run: Pick<Run | RunListItem, 'mode'>): boolean {
  return run.mode === 'SCENARIO'
}

/** 화면 이름. 사이트나 화면을 모르면 `pageKey`를 그대로 쓴다. */
export function pageLabel(
  site: Site | undefined,
  pageKey: Open<string>,
): string {
  return site?.pages.find((page) => page.pageKey === pageKey)?.label ?? pageKey
}
