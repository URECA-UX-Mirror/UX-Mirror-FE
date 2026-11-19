// 시나리오 테스트(외부 사이트) DTO. 계약서 v1.3.5에 없는 값이라 전부 `임시`다 (OI-11, FE #53).
// 형식은 장근창·정자비 님 답변(11-18)을 따른 mock 형식이며 백엔드 구현 뒤 실제 응답과 대조한다.

/** 임시(OI-11). 지금은 `SCENARIO`만 온다 */
export type SiteMode = 'SCENARIO'

export interface SitePageDto {
  pageKey: string
  /** 쿼리가 없는 경로 */
  path: string
  /** 화면 이름. 항상 있다 */
  label: string
  /** 도착 화면 확인용 글자. 없으면 `null` */
  goalText: string | null
  /** 도착 화면으로 고를 수 있는지(서버가 정한다). 없는 응답은 FE가 `goalText`와 시작 화면으로 판단한다 */
  goalSelectable?: boolean
}

export interface SiteDto {
  siteId: string
  name: string
  mode: SiteMode
  startPage: string
  pages: SitePageDto[]
  /** `available`이 `false`면 사이트 지도가 없다 */
  siteMap: { available: boolean }
}

/** GET /api/sites 응답 (임시, OI-11) */
export interface SiteListDto {
  items: SiteDto[]
}
