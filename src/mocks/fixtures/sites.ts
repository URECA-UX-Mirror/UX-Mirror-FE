import type { SiteDto } from '../../api/dto/index.ts'

// 시나리오 테스트용 등록 사이트 mock (임시, OI-11, FE #53). 값은 UX-Mirror-BE develop의
// `config/sites/cafe24-ons.json`과 `config/sitemaps/sitemap-cafe24-ons-v1.json`(BE #75 머지 기준)을 그대로 옮겼다.
// 서버는 `verification.path`가 등록 경로와 정확히 같을 때만 받는다(쿼리·다른 경로는 422). MORO MARKET은 목록에 넣지 않는다.
//
// `goalSelectable`은 서버가 정한다: 확인 글자가 있고, 시작 화면이 아니고, 지도에서 시작 화면부터 닿아야 true.
//   products·review·event·basket만 true. qna·guide·company는 시작 화면의 링크로 닿지 않아(UNREACHABLE_ON_SITE_MAP) false,
//   home은 시작 화면(START_PAGE), brand는 확인 글자가 없어(NO_GOAL_TEXT) false.

export const DEMO_SITE_ID = 'cafe24-ons'
export const NO_MAP_SITE_ID = 'demo-no-map'

export const SITES: SiteDto[] = [
  {
    siteId: DEMO_SITE_ID,
    name: 'ONS 공식몰 (cafe24 데모)',
    mode: 'SCENARIO',
    startPage: 'home',
    pages: [
      { pageKey: 'home', path: '/', label: '홈', goalText: null, goalSelectable: false, goalUnavailableReason: 'START_PAGE' },
      { pageKey: 'products', path: '/product/list.html', label: '제품 목록', goalText: '제품', goalSelectable: true, goalUnavailableReason: null },
      { pageKey: 'review', path: '/board/review/list.html', label: '상품 리뷰', goalText: '상품 리뷰', goalSelectable: true, goalUnavailableReason: null },
      { pageKey: 'qna', path: '/board/product/list.html', label: '상품 문의 (Q&A)', goalText: 'Q&A', goalSelectable: false, goalUnavailableReason: 'UNREACHABLE_ON_SITE_MAP' },
      { pageKey: 'event', path: '/board/gallery/list.html', label: '이벤트', goalText: 'EVENT', goalSelectable: true, goalUnavailableReason: null },
      { pageKey: 'guide', path: '/shopinfo/guide.html', label: '이용안내', goalText: '이용안내', goalSelectable: false, goalUnavailableReason: 'UNREACHABLE_ON_SITE_MAP' },
      { pageKey: 'company', path: '/shopinfo/company.html', label: '회사소개', goalText: '회사소개', goalSelectable: false, goalUnavailableReason: 'UNREACHABLE_ON_SITE_MAP' },
      { pageKey: 'basket', path: '/order/basket.html', label: '장바구니', goalText: '장바구니', goalSelectable: true, goalUnavailableReason: null },
      { pageKey: 'brand', path: '/ons/html/brand.html', label: '브랜드스토리', goalText: null, goalSelectable: false, goalUnavailableReason: 'NO_GOAL_TEXT' },
    ],
    siteMap: { available: true, siteMapVersion: 'sitemap-cafe24-ons-v1', unreachablePages: ['qna', 'guide', 'company'] },
  },
  {
    // 사이트 지도가 없는 사이트(`siteMap.available: false`). 지도가 없으면 닿는지는 판단하지 않는다
    siteId: NO_MAP_SITE_ID,
    name: '지도 없는 데모 사이트',
    mode: 'SCENARIO',
    startPage: 'home',
    pages: [
      { pageKey: 'home', path: '/', label: '홈', goalText: null, goalSelectable: false, goalUnavailableReason: 'START_PAGE' },
      { pageKey: 'notice', path: '/notice', label: '공지사항', goalText: '공지사항', goalSelectable: true, goalUnavailableReason: null },
    ],
    siteMap: { available: false, siteMapVersion: null, unreachablePages: null },
  },
]

export const findSite = (siteId: unknown): SiteDto | undefined =>
  SITES.find((site) => site.siteId === siteId)

/**
 * 사이트 지도 mock. `links`는 `sitemap-cafe24-ons-v1.json`의 화면별 이동 가능 화면(edges의 `to`)이다.
 * 거리·최단 클릭 수는 서버가 계산하며, 이 mock은 같은 지도에서 계산한 값을 흉내 낸다.
 */
export interface SiteMapFixture {
  siteMapVersion: string
  siteMapHash: string
  links: Record<string, string[]>
}

export const SITE_MAPS: Record<string, SiteMapFixture> = {
  [DEMO_SITE_ID]: {
    siteMapVersion: 'sitemap-cafe24-ons-v1',
    siteMapHash: 'sha256:8b479b3602acd0b61235c8931c2f1b2d001dc26dfb96a5bbc43917dd5117d5f8',
    links: {
      home: ['basket', 'brand', 'event', 'products', 'review'],
      products: ['basket', 'brand', 'event', 'home', 'review'],
      review: ['basket', 'brand', 'event', 'home', 'products'],
      event: ['basket', 'brand', 'home', 'products', 'review'],
      basket: ['brand', 'event', 'home', 'products', 'review'],
      brand: ['basket', 'event', 'products', 'review'],
      qna: ['basket', 'brand', 'event', 'home', 'products', 'review'],
      guide: ['basket', 'brand', 'event', 'home', 'products', 'review'],
      company: ['basket', 'brand', 'event', 'home', 'products', 'review'],
    },
  },
}
