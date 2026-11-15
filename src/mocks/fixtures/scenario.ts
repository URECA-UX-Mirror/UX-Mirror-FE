// MOCK 시나리오 정의. 응답 DTO와 같은 구조로 만들고 resultOrigin은 MOCK이다.
// 형식은 계약서를 따르지만 코드 문자열 등 일부 값은 가정이다(docs/operations/open_issue.md OI-9).
//
// MORO MARKET에서 "환불 신청" 목표를 수행하는 두 버전:
//   after : 홈 → 마이페이지 → (환불 신청 화면 도착)               Step 2개
//   before: 홈 → 이용정보 → 마이페이지 → (환불 신청 화면 도착)    Step 3개, 추가 이동 1회
// 두 버전의 홈 메뉴는 같은 semanticKey(`상단 메뉴>mypage#1`)이고 라벨만 다르다(OI-6).

import type { BoundingBox, Variant } from '../../api/dto/index.ts'

export type PageKey = 'home' | 'info' | 'mypage' | 'refund'

export interface PageDef {
  path: string
  title: string
}

export const PAGES: Record<PageKey, PageDef> = {
  home: { path: '/', title: 'MORO MARKET 홈' },
  info: { path: '/info', title: '이용정보' },
  mypage: { path: '/mypage', title: '마이페이지' },
  refund: { path: '/refund', title: '환불 신청' },
}

export interface CandidateDef {
  optionId: string
  label: string
  region: string
  bbox: BoundingBox
  semanticKey: string
  probability: number
  /** 목표 경로로 이어지는 후보 */
  onGoalPath?: boolean
  /** 이 후보를 누르면 이동하는 화면 */
  leadsTo: PageKey
}

export interface PageChoices {
  candidates: CandidateDef[]
  /** GO_BACK 선택지가 있으면 그 optionId */
  backOptionId: string | null
  goBackProbability: number | null
  /** 이 화면에서 모델이 고른 optionId */
  selectedOptionId: string
}

const HOME_MENU_BBOX: BoundingBox = { x: 570, y: 26, width: 84, height: 28 }

function homeChoices(variant: Variant): PageChoices {
  const before = variant === 'before'
  return {
    candidates: [
      {
        optionId: 'option_01',
        label: before ? '이용정보' : '마이페이지',
        region: '상단 메뉴',
        bbox: HOME_MENU_BBOX,
        semanticKey: '상단 메뉴>mypage#1',
        probability: before ? 0.5 : 0.62,
        onGoalPath: !before,
        leadsTo: before ? 'info' : 'mypage',
      },
      {
        optionId: 'option_02',
        label: '상품 목록',
        region: '상단 메뉴',
        bbox: { x: 470, y: 26, width: 84, height: 28 },
        semanticKey: '상단 메뉴>products#1',
        probability: before ? 0.32 : 0.25,
        leadsTo: 'home',
      },
      {
        // 아래 끝이 viewport(높이 900) 밖으로 나가는 후보: y 799 + height 196 = 995
        optionId: 'option_03',
        label: '공지사항',
        region: '하단',
        bbox: { x: 100, y: 799, width: 196, height: 196 },
        semanticKey: '하단>notice#1',
        probability: before ? 0.18 : 0.13,
        leadsTo: 'home',
      },
    ],
    backOptionId: null,
    goBackProbability: null,
    selectedOptionId: 'option_01',
  }
}

const INFO_CHOICES: PageChoices = {
  candidates: [
    {
      optionId: 'option_01',
      label: '홈으로',
      region: '경로 표시',
      bbox: { x: 40, y: 26, width: 60, height: 28 },
      semanticKey: '경로 표시>home#1',
      probability: 0.2,
      leadsTo: 'home',
    },
    {
      optionId: 'option_02',
      label: '마이페이지 바로가기',
      region: '본문',
      bbox: { x: 200, y: 300, width: 160, height: 32 },
      semanticKey: '본문>mypage#1',
      probability: 0.55,
      onGoalPath: true,
      leadsTo: 'mypage',
    },
  ],
  backOptionId: 'option_03',
  goBackProbability: 0.25,
  selectedOptionId: 'option_02',
}

function mypageChoices(variant: Variant): PageChoices {
  const before = variant === 'before'
  return {
    candidates: [
      {
        optionId: 'option_01',
        label: '주문 내역',
        region: '사이드 메뉴',
        bbox: { x: 40, y: 200, width: 120, height: 32 },
        semanticKey: '사이드 메뉴>orders#1',
        probability: before ? 0.3 : 0.22,
        leadsTo: 'mypage',
      },
      {
        optionId: 'option_02',
        label: '환불 신청',
        region: '사이드 메뉴',
        bbox: { x: 40, y: 240, width: 120, height: 32 },
        semanticKey: '사이드 메뉴>refund#1',
        probability: before ? 0.55 : 0.68,
        onGoalPath: true,
        leadsTo: 'refund',
      },
    ],
    backOptionId: 'option_03',
    goBackProbability: before ? 0.15 : 0.1,
    selectedOptionId: 'option_02',
  }
}

export function getChoices(variant: Variant, pageKey: PageKey): PageChoices {
  switch (pageKey) {
    case 'home':
      return homeChoices(variant)
    case 'info':
      return INFO_CHOICES
    case 'mypage':
      return mypageChoices(variant)
    case 'refund':
      throw new Error('도착 화면에는 Step이 없다(계약 §15.3, OI-3)')
  }
}

/** Step이 있는 화면의 방문 순서. 마지막에 `refund`(도착 화면)가 이어진다. */
export const STEP_PAGES: Record<Variant, PageKey[]> = {
  before: ['home', 'info', 'mypage'],
  after: ['home', 'mypage'],
}

export const GOAL = { goalId: 'goal_refund', goal: '주문한 상품의 환불을 신청한다' }
export const PERSONAS = [
  { personaId: 'persona_new_user', persona: '처음 이용하는 30대 사용자' },
  { personaId: 'persona_senior', persona: '온라인 쇼핑이 낯선 60대 사용자' },
]

export const VIEWPORT = { width: 1440, height: 900 }
