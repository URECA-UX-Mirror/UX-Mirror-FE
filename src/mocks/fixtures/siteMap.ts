import type { SiteDto, SiteMapConfigDto } from '../../api/dto/index.ts'
import { SITE_MAPS } from './sites.ts'
import { PAGES, type PageKey } from './scenario.ts'

// SITE_MAP 기준 mock. 실제 서버가 계산하는 값을 흉내 내는 용도이며 FE 코드는 이 계산을 하지 않는다.
// 설정 형식은 설계 v2.1 §4.1, 우회 이동 정의는 §3.1(모델 CLICK 이동 중 d(이동 후) >= d(이동 전), BACK 제외)을 따른다.

/** 쇼핑몰 화면 사이의 링크(목업 쇼핑몰과 같은 구조) */
const LINKS: Record<PageKey, PageKey[]> = {
  home: ['orders', 'mypage', 'support'],
  mypage: ['orders', 'refund', 'home'],
  orders: ['refund', 'home'],
  support: ['home'],
  refund: ['home'],
}

/** 목표 화면까지의 최소 클릭 수. 도달할 수 없으면 `null` */
export function siteMapDistances(goal: PageKey): Record<PageKey, number | null> {
  const distances: Record<PageKey, number | null> = {
    home: null,
    mypage: null,
    orders: null,
    support: null,
    refund: null,
  }
  distances[goal] = 0
  const queue: PageKey[] = [goal]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const page of Object.keys(LINKS) as PageKey[]) {
      if (distances[page] === null && LINKS[page].includes(current)) {
        distances[page] = (distances[current] ?? 0) + 1
        queue.push(page)
      }
    }
  }
  return distances
}

/** 성공 조건의 경로에 해당하는 화면. 알 수 없으면 환불 화면 */
export function goalPageKeyOf(verificationPath: string | undefined): PageKey {
  const found = (Object.keys(PAGES) as PageKey[]).find(
    (key) => PAGES[key].path === verificationPath,
  )
  return found ?? 'refund'
}

export function siteMapConfig(goal: PageKey): SiteMapConfigDto {
  const distances = siteMapDistances(goal)
  return {
    basis: 'SITE_MAP',
    siteMapVersion: 'sitemap-v1',
    siteMapHash: 'sha256:mock-sitemap-v1',
    startPageKey: 'home',
    goalPageKey: goal,
    shortestSteps: distances.home ?? 0,
    distances,
  }
}

/**
 * 우회 이동 수. BACK은 세지 않고, CLICK 이동 중 목표까지의 거리가 줄지 않은 이동만 센다.
 * 거리를 모르는(`null`) 화면이 낀 이동은 세지 않는다.
 */
export function countDetourMoves(
  moves: { to: PageKey; back: boolean }[],
  distances: Record<string, number | null>,
  start: PageKey = 'home',
): number {
  let from = start
  let count = 0
  for (const move of moves) {
    if (!move.back) {
      const before = distances[from]
      const after = distances[move.to]
      if (before != null && after != null && after >= before) count += 1
    }
    from = move.to
  }
  return count
}

/** 이 화면에서 목표에 더 가까워지는 이동인지(`goalPathProbability`에 합산되는 후보 조건) */
export function movesCloser(
  distances: Record<string, number | null>,
  from: PageKey,
  to: PageKey,
): boolean {
  const before = distances[from]
  const after = distances[to]
  return before !== undefined && after !== undefined && (after ?? Infinity) < (before ?? Infinity)
}

/**
 * 시나리오 사이트의 사이트 지도 기준(`SITE_MAP`). 지도가 없는 사이트면 `null`(기준 없음).
 * 거리는 지도의 링크를 거꾸로 따라간 목표까지의 최소 클릭 수이고, 목표에 닿을 수 없는 화면은 `null`이다.
 * 서버 계산의 근사이며 FE 코드는 이 계산을 하지 않는다(OI-11).
 */
export function siteMapConfigForSite(
  site: SiteDto,
  goalPageKey: string,
): SiteMapConfigDto | null {
  const map = SITE_MAPS[site.siteId]
  if (!site.siteMap.available || !map) return null
  const distances: Record<string, number | null> = Object.fromEntries(
    site.pages.map((page) => [page.pageKey, null]),
  )
  distances[goalPageKey] = 0
  const queue = [goalPageKey]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const [page, links] of Object.entries(map.links)) {
      if (distances[page] === null && links.includes(current)) {
        distances[page] = (distances[current] ?? 0) + 1
        queue.push(page)
      }
    }
  }
  return {
    basis: 'SITE_MAP',
    siteMapVersion: map.siteMapVersion,
    siteMapHash: map.siteMapHash,
    startPageKey: site.startPage,
    goalPageKey,
    shortestSteps: distances[site.startPage] ?? 0,
    distances,
  }
}
