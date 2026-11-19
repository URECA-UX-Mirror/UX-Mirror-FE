import type { SiteDto, SiteListDto, SitePageDto } from '../api/dto/index.ts'
import type { Site, SitePage } from '../domain/types.ts'

/**
 * `goalSelectable`이 없는 응답은 확인 글자(`goalText`)가 있고 시작 화면이 아닌 화면을 선택 가능으로 본다.
 * 지도에서 닿는지는 서버만 알 수 있어 여기서 판단하지 않는다(임시, OI-11).
 */
function toSitePage(dto: SitePageDto, startPage: string): SitePage {
  // 필드가 없는 응답(`undefined`)도 확인 글자 없음으로 본다
  const goalText = dto.goalText ?? null
  return {
    pageKey: dto.pageKey,
    path: dto.path,
    label: dto.label,
    goalText,
    goalSelectable:
      dto.goalSelectable ?? (goalText !== null && dto.pageKey !== startPage),
    goalUnavailableReason: dto.goalUnavailableReason ?? null,
  }
}

export function toSite(dto: SiteDto): Site {
  return {
    siteId: dto.siteId,
    name: dto.name,
    mode: dto.mode,
    startPage: dto.startPage,
    pages: dto.pages.map((page) => toSitePage(page, dto.startPage)),
    siteMapAvailable: dto.siteMap.available,
    siteMapVersion: dto.siteMap.siteMapVersion ?? null,
    unreachablePages: dto.siteMap.unreachablePages ?? null,
  }
}

/** 서버 순서를 그대로 유지한다. */
export function toSiteList(dto: SiteListDto): Site[] {
  return dto.items.map(toSite)
}
