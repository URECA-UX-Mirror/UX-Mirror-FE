// MOCK 시나리오 정의. 응답 DTO와 같은 구조로 만들고 resultOrigin은 MOCK이다.
// 값과 형식은 계약서 v1.3.5의 예시(§12.4, §15.6)와 실제 쇼핑몰(`/shop/{home,mypage,orders,support,refund}`)을 따른다.
// 후보 bbox는 `mock-pages/`의 목업 쇼핑몰 화면과 맞춘다(`npm run mock:shots`가 어긋나면 실패한다).
//
// 목표 "환불 신청 화면 찾기"(`refund`). 허용 경로: home→orders→refund, home→mypage→refund,
// home→mypage→orders→refund (최단 2회). 두 버전은 홈 상단 메뉴 라벨만 다르다
// (Before `이용정보` / After `주문·환불`, 같은 semanticKey `상단 메뉴>/shop/orders#1`).
//
//   before : 홈 → 마이페이지 → 주문 내역 → (환불 신청 화면 도착)   모델 선택 3회, 추가 이동 1회
//   after  : 홈 → 주문 내역 → (환불 신청 화면 도착)               모델 선택 2회
//   direct : before와 같은 버전이지만 홈 본문 카드로 바로 주문 내역에 감 (after와 방문 화면이 같아 비교가 COMPLETED)
//   goback : 홈 → 마이페이지 → (뒤로) 홈 → 주문 내역 → (도착)      모델 GO_BACK과 재방문 포함

import type { BoundingBox, Variant } from '../../api/dto/index.ts'

export type PageKey = 'home' | 'mypage' | 'orders' | 'support' | 'refund'
export type ScenarioName = Variant | 'direct' | 'goback'

export interface PageDef {
  path: string
  title: string
}

export const PAGES: Record<PageKey, PageDef> = {
  home: { path: '/shop/home', title: 'MORO MARKET 홈' },
  mypage: { path: '/shop/mypage', title: '마이페이지' },
  orders: { path: '/shop/orders', title: '주문 내역' },
  support: { path: '/shop/support', title: '고객센터' },
  refund: { path: '/shop/refund', title: '환불 / 반품 신청' },
}

export const pageSignature = (pageKey: PageKey) => `${pageKey}_default`

export interface CandidateDef {
  optionId: string
  label: string
  region: string
  context: string | null
  href: string
  bbox: BoundingBox
  /** `영역>목적지#순번`. 라벨을 쓰지 않아 Before/After에서 같은 값 */
  semanticKey: string
  probability: number
  /** 허용 경로에서 다음 화면으로 이어지는 후보(goalPathProbability 계산용) */
  onGoalPath?: boolean
  /** 이 후보를 누르면 이동하는 화면 */
  leadsTo: PageKey
}

export interface PageChoices {
  candidates: CandidateDef[]
  /** GO_BACK 선택지가 있으면 그 optionId. 후보 객체가 아니다 */
  backOptionId: string | null
  goBackProbability: number | null
}

export interface StepSpec {
  pageKey: PageKey
  choices: PageChoices
  /** 모델이 고른 optionId 또는 `BACK`(GO_BACK) */
  selected: string
}

const BACK_OPTION = 'option_06'

// ---- 홈 ----

function homeChoices(variant: Variant): PageChoices {
  const before = variant === 'before'
  return {
    candidates: [
      {
        optionId: 'option_01',
        label: before ? '이용정보' : '주문·환불',
        region: '상단 메뉴',
        context: null,
        href: '/shop/orders',
        bbox: { x: 570, y: 26, width: 84, height: 28 },
        semanticKey: '상단 메뉴>/shop/orders#1',
        probability: before ? 0.114 : 0.502,
        onGoalPath: true,
        leadsTo: 'orders',
      },
      {
        optionId: 'option_02',
        label: '마이페이지',
        region: '상단 메뉴',
        context: null,
        href: '/shop/mypage',
        bbox: { x: 470, y: 26, width: 84, height: 28 },
        semanticKey: '상단 메뉴>/shop/mypage#1',
        probability: before ? 0.32 : 0.15,
        onGoalPath: true,
        leadsTo: 'mypage',
      },
      {
        optionId: 'option_03',
        label: '고객센터',
        region: '상단 메뉴',
        context: null,
        href: '/shop/support',
        bbox: { x: 670, y: 26, width: 84, height: 28 },
        semanticKey: '상단 메뉴>/shop/support#1',
        probability: before ? 0.18 : 0.08,
        leadsTo: 'support',
      },
      {
        optionId: 'option_04',
        label: '실시간 조회 이용정보 · 주문/배송',
        region: '본문',
        context: '주문/배송',
        href: '/shop/orders',
        // 아래 끝이 viewport(높이 900) 밖으로 나간다: y 799 + height 196 = 995
        bbox: { x: 100, y: 799, width: 196, height: 196 },
        semanticKey: '본문>/shop/orders#1',
        probability: before ? 0.25 : 0.17,
        onGoalPath: true,
        leadsTo: 'orders',
      },
      {
        optionId: 'option_05',
        label: '환불 · 반품 안내',
        region: '본문',
        context: '환불·반품',
        href: '/shop/support',
        bbox: { x: 330, y: 520, width: 196, height: 120 },
        semanticKey: '본문>/shop/support#1',
        probability: before ? 0.136 : 0.098,
        leadsTo: 'support',
      },
    ],
    backOptionId: null,
    goBackProbability: null,
  }
}

// ---- 마이페이지 ----

function mypageChoices(backHeavy: boolean): PageChoices {
  return {
    candidates: [
      {
        optionId: 'option_01',
        label: '환불 신청',
        region: '사이드 메뉴',
        context: '쇼핑 관리',
        href: '/shop/refund',
        bbox: { x: 40, y: 240, width: 120, height: 32 },
        semanticKey: '사이드 메뉴>/shop/refund#1',
        probability: backHeavy ? 0.2 : 0.3,
        onGoalPath: true,
        leadsTo: 'refund',
      },
      {
        optionId: 'option_02',
        label: '주문 내역',
        region: '사이드 메뉴',
        context: '쇼핑 관리',
        href: '/shop/orders',
        bbox: { x: 40, y: 200, width: 120, height: 32 },
        semanticKey: '사이드 메뉴>/shop/orders#1',
        probability: backHeavy ? 0.15 : 0.45,
        onGoalPath: true,
        leadsTo: 'orders',
      },
      {
        optionId: 'option_03',
        label: '홈으로',
        region: '경로 표시',
        context: null,
        href: '/shop/home',
        bbox: { x: 40, y: 100, width: 60, height: 28 },
        semanticKey: '경로 표시>/shop/home#1',
        probability: backHeavy ? 0.1 : 0.1,
        leadsTo: 'home',
      },
    ],
    backOptionId: BACK_OPTION,
    goBackProbability: backHeavy ? 0.55 : 0.15,
  }
}

// ---- 주문 내역 ----

function ordersChoices(variant: Variant): PageChoices {
  const before = variant === 'before'
  return {
    candidates: [
      {
        optionId: 'option_01',
        label: '환불 신청',
        region: '본문',
        context: '최근 주문',
        href: '/shop/refund',
        bbox: { x: 980, y: 320, width: 120, height: 36 },
        semanticKey: '본문>/shop/refund#1',
        probability: before ? 0.62 : 0.74,
        onGoalPath: true,
        leadsTo: 'refund',
      },
      {
        optionId: 'option_02',
        label: '마이페이지',
        region: '상단 메뉴',
        context: null,
        href: '/shop/mypage',
        bbox: { x: 470, y: 26, width: 84, height: 28 },
        semanticKey: '상단 메뉴>/shop/mypage#1',
        probability: before ? 0.15 : 0.1,
        leadsTo: 'mypage',
      },
      {
        optionId: 'option_03',
        label: '홈으로',
        region: '경로 표시',
        context: null,
        href: '/shop/home',
        bbox: { x: 40, y: 100, width: 60, height: 28 },
        semanticKey: '경로 표시>/shop/home#1',
        probability: before ? 0.13 : 0.08,
        leadsTo: 'home',
      },
    ],
    backOptionId: BACK_OPTION,
    goBackProbability: before ? 0.1 : 0.08,
  }
}

export function stepSpecs(scenario: ScenarioName): StepSpec[] {
  switch (scenario) {
    case 'before':
      return [
        { pageKey: 'home', choices: homeChoices('before'), selected: 'option_02' },
        { pageKey: 'mypage', choices: mypageChoices(false), selected: 'option_02' },
        { pageKey: 'orders', choices: ordersChoices('before'), selected: 'option_01' },
      ]
    case 'direct':
      return [
        { pageKey: 'home', choices: homeChoices('before'), selected: 'option_04' },
        { pageKey: 'orders', choices: ordersChoices('before'), selected: 'option_01' },
      ]
    case 'after':
      return [
        { pageKey: 'home', choices: homeChoices('after'), selected: 'option_01' },
        { pageKey: 'orders', choices: ordersChoices('after'), selected: 'option_01' },
      ]
    case 'goback':
      return [
        { pageKey: 'home', choices: homeChoices('before'), selected: 'option_02' },
        { pageKey: 'mypage', choices: mypageChoices(true), selected: 'BACK' },
        { pageKey: 'home', choices: homeChoices('before'), selected: 'option_01' },
        { pageKey: 'orders', choices: ordersChoices('before'), selected: 'option_01' },
      ]
  }
}

/** 이 시나리오에서 허용 경로의 최단 클릭 수(`shortestAllowedSteps`) */
export const SHORTEST_ALLOWED_STEPS = 2

export const GOAL = {
  goalId: 'refund',
  goal: '최근 구매한 상품의 환불 신청 화면 찾기',
}
/** preset 목표의 성공 조건. Run에는 기본값을 채운 형태로 저장된다(UX-Mirror-BE #42) */
export const GOAL_VERIFICATION = {
  type: 'PATH_AND_VISIBLE_TEXT',
  path: '/shop/refund',
  text: '환불 / 반품 신청',
  exact: false,
  scope: 'page',
}
export const REFERENCE_PATH_CONFIG = {
  version: 'refpath-v1',
  allowedPaths: [['home', 'orders', 'refund'], ['home', 'mypage', 'refund'], ['home', 'mypage', 'orders', 'refund']],
  shortestAllowedSteps: 2,
}
export const PERSONAS = [
  {
    personaId: 'novice-shopper',
    persona: '온라인 쇼핑몰 이용 경험이 적고 환불 절차에 익숙하지 않은 사용자',
  },
]

export const VIEWPORT = { width: 1440, height: 900 }
