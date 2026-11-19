import { listSites } from '../api/sites.ts'
import { isScenarioRun } from '../domain/site.ts'
import type { Run } from '../domain/types.ts'
import { usePolling } from './polling/usePolling.ts'

/** 시나리오 Run에만 사이트 정보를 조회한다. 실패하면 사이트 ID와 화면 키를 사용한다. */
export function useRunSite(run: Run | undefined) {
  const sites = usePolling({
    fetch: listSites,
    isDone: () => true,
    resetKey: run?.siteId ?? '',
    enabled: !!run && isScenarioRun(run) && !!run.siteId,
  })
  return run && isScenarioRun(run)
    ? sites.data?.find((site) => site.siteId === run.siteId)
    : undefined
}
