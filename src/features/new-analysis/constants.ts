export const SITE = { name: 'MORO MARKET' } as const
export const VERSIONS = [
  { variant: 'before', name: 'v1 (변경 전)', change: '상단 메뉴: 이용정보' },
  { variant: 'after', name: 'v2 (변경 후)', change: '상단 메뉴: 주문·환불' },
] as const
/** "새 UX 분석"에서 직접 분석하는 버전은 v1뿐이다. 변경 후 버전은 자동 개선 최종안 행이 맡는다(`FinalVariantRow`) */
export const ANALYZED_VERSIONS = VERSIONS.filter((item) => item.variant === 'before')
export const STEPS = { min: 1, max: 15, default: 8 } as const
/** 직접 입력 길이 제한 (UX-Mirror-BE #42: 목표·사용자 유형 200자, 성공 조건 글자 100자) */
export const INPUT_LIMITS = { sentence: 200, verificationText: 100 } as const
/**
 * 직접 입력한 목표의 도착 화면. 현재 지원하는 MORO MARKET 화면만 목록에서 고른다.
 * 시작 화면(home)은 시작하자마자 도착이 되므로 뺀다.
 * `text`는 그 화면에만 보이는 제목(UX-Mirror-BE `shop/moro-before`의 h1·h2). 도착 화면을 고르면 성공 조건 글자로 채운다.
 * `text`는 시작할 때 성공 조건을 채우는 기본값이다. 띄어쓰기까지 화면과 같아야 하므로
 * (예: `주문 / 배송 조회`) 사용자가 직접 옮겨 적지 않게 한다. 시작 전 검사는 서버가 맡는다.
 */
export const GOAL_PAGES = [
  { path: '/shop/refund', label: '환불 신청', text: '환불 / 반품 신청' },
  { path: '/shop/orders', label: '주문/배송 조회', text: '주문 / 배송 조회' },
  { path: '/shop/mypage', label: '마이페이지', text: '김모로 님' },
  { path: '/shop/support', label: '고객센터', text: '자주 묻는 질문' },
] as const
export const SCOPES = [
  { value: 'page', label: '화면 전체' },
  { value: 'main', label: '본문(main) 안' },
] as const
export function createExperimentKey() {
  return `exp_${crypto.randomUUID().replaceAll('-', '')}`
}
