import type { SiteDto } from '../../api/dto/index.ts'

// 시나리오 테스트용 등록 사이트 mock (임시, OI-11, FE #53). 정자비 님이 공유한 시연 사이트 설정 `cafe24-ons`의 최신 버전을 본뜬다.
// 로그인 화면은 설정에서 빠졌다. MORO MARKET은 목록에 넣지 않는다.
// `goalSelectable`은 서버가 정해 주는 값이다: 확인 글자가 있고, 시작 화면이 아니고, 지도에서 시작 화면부터 닿아야 true.
//   products·review·event·basket만 true. guide·company·qna는 링크가 푸터에만 있어 첫 화면에서 닿지 않아 false,
//   home·brand는 goalText가 null이라 false.

export const DEMO_SITE_ID = 'cafe24-ons'
export const NO_MAP_SITE_ID = 'demo-no-map'

export const SITES: SiteDto[] = [
  {
    siteId: DEMO_SITE_ID,
    name: 'ONS 공식몰 (cafe24 데모)',
    mode: 'SCENARIO',
    startPage: 'home',
    pages: [
      { pageKey: 'home', path: '/', label: '홈', goalText: null, goalSelectable: false },
      { pageKey: 'products', path: '/product/list.html', label: '상품 목록', goalText: '전체 상품', goalSelectable: true },
      { pageKey: 'review', path: '/board/review/4/', label: '구매후기', goalText: '구매후기', goalSelectable: true },
      { pageKey: 'qna', path: '/board/qna/6/', label: '상품 Q&A', goalText: '상품 Q&A', goalSelectable: false },
      { pageKey: 'event', path: '/board/event/8/', label: '이벤트', goalText: '이벤트', goalSelectable: true },
      { pageKey: 'guide', path: '/board/guide/3/', label: '이용안내', goalText: '이용안내', goalSelectable: false },
      { pageKey: 'company', path: '/board/company/2/', label: '회사소개', goalText: '회사소개', goalSelectable: false },
      { pageKey: 'basket', path: '/order/basket.html', label: '장바구니', goalText: '장바구니', goalSelectable: true },
      { pageKey: 'brand', path: '/brand/story.html', label: '브랜드 스토리', goalText: null, goalSelectable: false },
    ],
    siteMap: { available: true },
  },
  {
    // 사이트 지도가 없는 사이트(`siteMap.available: false`). 화면 목록만 있다
    siteId: NO_MAP_SITE_ID,
    name: '지도 없는 데모 사이트',
    mode: 'SCENARIO',
    startPage: 'home',
    pages: [
      { pageKey: 'home', path: '/', label: '홈', goalText: null, goalSelectable: false },
      { pageKey: 'notice', path: '/notice', label: '공지사항', goalText: '공지사항', goalSelectable: true },
    ],
    siteMap: { available: false },
  },
]

export const findSite = (siteId: unknown): SiteDto | undefined =>
  SITES.find((site) => site.siteId === siteId)
