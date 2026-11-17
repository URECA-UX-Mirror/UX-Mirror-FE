// MOCK 스크린샷. 쇼핑몰(MORO MARKET)처럼 보이는 1440×900 SVG를 화면(pageKey)별로 만든다.
// 요소 위치는 `scenario.ts`의 후보 bbox와 맞춘다(바꾸면 두 파일을 함께 고친다).
// 실제 서버는 PNG를 주지만 `<img>`에는 형식 차이가 없다. 이 이미지는 실제 쇼핑몰 화면이 아니다.

import type { PageKey } from './scenario.ts'

const W = 1440
const H = 900
const FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif"

// 쇼핑몰 팔레트(앱 UI와 별개)
const INK = '#1f2937'
const MUTED = '#6b7280'
const LINE = '#e7e2d9'
const PAPER = '#fbf9f6'
const WHITE = '#ffffff'
const BRAND = '#c2410c'
const BRAND_SOFT = '#fdeee4'
const SAGE = '#8fa98a'
const SAND = '#efe6d8'
const CLAY = '#d9774a'
const NAVY = '#334155'

interface TextOpts {
  size?: number
  weight?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
}

function text(x: number, y: number, value: string, opts: TextOpts = {}) {
  const { size = 14, weight = 400, fill = INK, anchor = 'start' } = opts
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${value}</text>`
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  opts: { stroke?: string; radius?: number } = {},
) {
  const stroke = opts.stroke ? ` stroke="${opts.stroke}"` : ''
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${opts.radius ?? 0}" fill="${fill}"${stroke}/>`
}

function circle(cx: number, cy: number, r: number, fill: string, stroke?: string) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}"` : ''}/>`
}

// ---- 상품 일러스트(실제 사진 대신 단순한 도형) ----

function plate(cx: number, cy: number, r: number, fill: string) {
  return [circle(cx, cy, r, fill), circle(cx, cy, r * 0.68, 'none', 'rgb(255 255 255 / 55%)')].join('')
}

function cup(x: number, y: number, w: number, h: number, fill: string) {
  const handle = `<path d="M${x + w} ${y + h * 0.25} h${w * 0.28} v${h * 0.4} h${-w * 0.28}" fill="none" stroke="${fill}" stroke-width="${Math.max(3, w * 0.1)}"/>`
  return `${rect(x, y, w, h, fill, { radius: w * 0.14 })}${handle}`
}

function candle(x: number, y: number, w: number, h: number, fill: string) {
  return [
    rect(x, y, w, h, fill, { radius: 4 }),
    rect(x + w / 2 - 1, y - 10, 2, 10, INK),
    `<path d="M${x + w / 2} ${y - 26} q8 10 0 16 q-8 -6 0 -16" fill="#f59e0b"/>`,
  ].join('')
}

function rug(x: number, y: number, w: number, h: number, fill: string) {
  return [
    rect(x, y, w, h, fill, { radius: 6 }),
    rect(x + 8, y + 8, w - 16, h - 16, 'none', { stroke: 'rgb(255 255 255 / 65%)', radius: 4 }),
    rect(x + 16, y + 16, w - 32, h - 32, 'none', { stroke: 'rgb(255 255 255 / 40%)', radius: 3 }),
  ].join('')
}

function linen(x: number, y: number, w: number, h: number, fill: string) {
  const lines: string[] = []
  for (let i = 1; i < 6; i++) {
    lines.push(`<line x1="${x}" y1="${y + (h / 6) * i}" x2="${x + w}" y2="${y + (h / 6) * i}" stroke="rgb(255 255 255 / 45%)" stroke-width="2"/>`)
  }
  return rect(x, y, w, h, fill, { radius: 6 }) + lines.join('')
}

type Art = 'linen' | 'mug' | 'candle' | 'rug'

function art(kind: Art, x: number, y: number, size: number) {
  const tile = rect(x, y, size, size, SAND, { radius: 8 })
  const p = size * 0.18
  switch (kind) {
    case 'linen':
      return tile + linen(x + p, y + p, size - p * 2, size - p * 2, SAGE)
    case 'mug':
      return tile + cup(x + size * 0.28, y + size * 0.3, size * 0.36, size * 0.42, CLAY)
    case 'candle':
      return tile + candle(x + size * 0.34, y + size * 0.4, size * 0.32, size * 0.36, WHITE)
    case 'rug':
      return tile + rug(x + p, y + size * 0.28, size - p * 2, size * 0.44, NAVY)
  }
}

function product(x: number, y: number, kind: Art, name: string, price: string) {
  return [
    rect(x, y, 250, 110, WHITE, { stroke: LINE, radius: 10 }),
    art(kind, x + 12, y + 12, 86),
    text(x + 112, y + 38, name, { size: 14, weight: 700 }),
    text(x + 112, y + 62, price, { size: 14, weight: 700, fill: BRAND }),
    text(x + 112, y + 86, '무료배송 · 평점 4.8', { size: 12, fill: MUTED }),
  ].join('')
}

// ---- 공통 영역 ----

/** 상단 메뉴. 세 항목의 위치는 bbox(470·570·670, y 26, 84×28)와 같다 */
function header(menuLabel: string, withCategories = false) {
  const items: [number, string][] = [
    [470, '마이페이지'],
    [570, menuLabel],
    [670, '고객센터'],
  ]
  const cats = ['신상품', '베스트', '기획전', '리빙', '키친', '패브릭', '아울렛']
  return [
    rect(0, 0, W, 80, WHITE),
    rect(0, 79, W, 1, LINE),
    rect(40, 22, 36, 36, BRAND, { radius: 8 }),
    text(58, 48, 'M', { size: 22, weight: 700, fill: WHITE, anchor: 'middle' }),
    text(88, 48, 'MORO MARKET', { size: 22, weight: 700 }),
    ...items.map(([x, label]) =>
      text(x + 42, 45, label, { size: 15, weight: 600, fill: NAVY, anchor: 'middle' }),
    ),
    rect(1040, 22, 240, 36, PAPER, { stroke: LINE, radius: 18 }),
    text(1062, 45, '상품·브랜드 검색', { size: 13, fill: MUTED }),
    text(1310, 45, '장바구니 (2)', { size: 14, weight: 600, fill: NAVY }),
    text(1396, 45, '로그인', { size: 14, fill: MUTED }),
    // 카테고리 줄은 홈에만 있다(다른 화면은 이 자리에 '홈으로' 버튼이 온다)
    ...(withCategories
      ? [
          rect(0, 80, W, 36, PAPER),
          rect(0, 115, W, 1, LINE),
          ...cats.map((c, i) => text(100 + i * 88, 103, c, { size: 14, weight: i === 0 ? 700 : 400, fill: i === 0 ? BRAND : NAVY })),
        ]
      : []),
  ].join('')
}

function breadcrumb(trail = '') {
  // bbox 40,100,60×28 — 홈으로 버튼
  return [
    rect(40, 100, 60, 28, WHITE, { stroke: LINE, radius: 6 }),
    text(70, 119, '홈으로', { size: 13, weight: 600, fill: NAVY, anchor: 'middle' }),
    trail ? text(112, 119, trail, { size: 13, fill: MUTED }) : '',
  ].join('')
}

function shortcut(x: number, y: number, w: number, h: number, title: string, sub: string, hot = false) {
  return [
    rect(x, y, w, h, hot ? BRAND_SOFT : WHITE, { stroke: hot ? '#f4c9ad' : LINE, radius: 10 }),
    circle(x + 30, y + 32, 14, hot ? CLAY : SAND),
    text(x + 16, y + 76, title, { size: 15, weight: 700 }),
    text(x + 16, y + 98, sub, { size: 12, fill: MUTED }),
  ].join('')
}

// ---- 화면 ----

function home(menuLabel: string) {
  return [
    header(menuLabel, true),
    // 배너
    rect(100, 140, 1240, 340, SAND, { radius: 16 }),
    text(160, 230, 'SUMMER SEASON DROP', { size: 14, weight: 700, fill: BRAND }),
    text(160, 292, '내추럴 리빙 컬렉션', { size: 40, weight: 700 }),
    text(160, 342, '20% 특별전', { size: 40, weight: 700, fill: BRAND }),
    text(160, 384, '자연을 닮은 테이블웨어와 패브릭 소품 모음', { size: 17, fill: MUTED }),
    rect(160, 412, 130, 40, INK, { radius: 20 }),
    text(225, 438, '기획전 보기', { size: 14, weight: 700, fill: WHITE, anchor: 'middle' }),
    circle(1080, 310, 190, 'rgb(255 255 255 / 55%)'),
    plate(1010, 330, 96, WHITE),
    plate(1010, 330, 62, SAND),
    cup(1130, 290, 70, 84, CLAY),
    linen(960, 410, 230, 44, SAGE),
    // 바로가기(환불·반품 안내 bbox 330,520,196×120)
    text(100, 506, '바로가기', { size: 15, weight: 700 }),
    shortcut(100, 520, 196, 120, '공지사항', '서비스 점검 안내'),
    shortcut(330, 520, 196, 120, '환불 · 반품 안내', '신청 방법과 기한', true),
    shortcut(560, 520, 196, 120, '쿠폰 · 혜택', '이번 달 혜택'),
    // 인기 상품
    text(800, 506, '이번 주 인기 상품', { size: 15, weight: 700 }),
    product(800, 520, 'linen', '오가닉 린넨 키친웨어', '18,000원'),
    product(1070, 520, 'mug', '아티장 핸드크래프트 머그', '24,500원'),
    product(800, 650, 'candle', '소이 왁스 무드 캔들', '19,000원'),
    product(1070, 650, 'rug', '코튼 라운드 러그', '39,000원'),
    // 고객 지원: 주문/배송 이용정보(bbox 100,799,196×196, 화면 아래로 이어진다)
    text(100, 780, '고객 지원', { size: 15, weight: 700 }),
    rect(100, 799, 196, 196, WHITE, { stroke: LINE, radius: 10 }),
    circle(130, 831, 14, SAND),
    text(116, 880, '실시간 조회', { size: 13, fill: MUTED }),
    text(116, 902, '이용정보 · 주문/배송', { size: 15, weight: 700 }),
  ].join('')
}

function sideMenu(active: string) {
  const groups: [number, string, [number, string][]][] = [
    [172, '쇼핑 관리', [[200, '주문 내역'], [240, '환불 신청']]],
  ]
  const rest = ['위시리스트', '쿠폰함', '리뷰 관리', '배송지 관리']
  return [
    rect(40, 150, 180, 330, WHITE, { stroke: LINE, radius: 10 }),
    ...groups.flatMap(([y, title, rows]) => [
      text(52, y, title, { size: 12, weight: 700, fill: MUTED }),
      ...rows.map(([ry, label]) =>
        [
          // 메뉴 항목 위치는 bbox(40,200,120×32), (40,240,120×32)와 같다
          label === active ? rect(40, ry, 120, 32, BRAND_SOFT, { radius: 6 }) : '',
          text(52, ry + 21, label, { size: 14, weight: label === active ? 700 : 500, fill: label === active ? BRAND : NAVY }),
        ].join(''),
      ),
    ]),
    text(52, 300, '내 정보', { size: 12, weight: 700, fill: MUTED }),
    ...rest.map((label, i) => text(52, 328 + i * 36, label, { size: 14, fill: NAVY })),
  ].join('')
}

function stat(x: number, label: string, value: string) {
  return [
    rect(x, 205, 280, 110, WHITE, { stroke: LINE, radius: 10 }),
    text(x + 20, 240, label, { size: 13, fill: MUTED }),
    text(x + 20, 284, value, { size: 28, weight: 700 }),
  ].join('')
}

function mypage(menuLabel: string) {
  const rows = ['오가닉 린넨 키친웨어', '소이 왁스 무드 캔들', '아티장 핸드크래프트 머그']
  return [
    header(menuLabel),
    breadcrumb('마이페이지'),
    sideMenu(''),
    text(260, 175, '마이페이지', { size: 28, weight: 700 }),
    text(260, 196, '김모로님, 환영합니다', { size: 14, fill: MUTED }),
    stat(260, '배송 중', '2건'),
    stat(560, '사용 가능 쿠폰', '3장'),
    stat(860, '적립금', '4,200원'),
    rect(260, 345, 880, 230, WHITE, { stroke: LINE, radius: 10 }),
    text(284, 380, '최근 주문', { size: 16, weight: 700 }),
    ...rows.flatMap((name, i) => [
      rect(284, 400 + i * 54, 40, 40, SAND, { radius: 6 }),
      text(336, 425 + i * 54, name, { size: 14, weight: 600 }),
      text(1100, 425 + i * 54, i === 0 ? '배송 완료' : '구매 확정', { size: 13, fill: '#047857', anchor: 'end' }),
    ]),
  ].join('')
}

function orders(menuLabel: string) {
  // 환불 신청 버튼은 bbox 980,320,120×36
  const names = ['오가닉 린넨 키친웨어', '소이 왁스 무드 캔들', '아티장 핸드크래프트 머그']
  const kinds: Art[] = ['linen', 'candle', 'mug']
  const prices = ['18,000원', '19,000원', '24,500원']
  const rows = [300, 400, 500]
  return [
    header(menuLabel),
    breadcrumb('주문 내역'),
    text(40, 190, '주문 내역', { size: 28, weight: 700 }),
    ...['전체', '배송 중', '배송 완료', '취소·환불'].map((label, i) =>
      [
        rect(40 + i * 92, 206, 84, 28, i === 0 ? INK : WHITE, { stroke: i === 0 ? INK : LINE, radius: 14 }),
        text(82 + i * 92, 225, label, { size: 13, weight: 600, fill: i === 0 ? WHITE : NAVY, anchor: 'middle' }),
      ].join(''),
    ),
    rect(40, 244, 1360, 40, PAPER, { radius: 8 }),
    text(60, 269, '상품', { size: 13, weight: 700, fill: MUTED }),
    text(700, 269, '주문일', { size: 13, weight: 700, fill: MUTED }),
    text(860, 269, '상태', { size: 13, weight: 700, fill: MUTED }),
    ...rows.map((y, i) =>
      [
        rect(40, y, 1360, 76, WHITE, { stroke: LINE, radius: 10 }),
        art(kinds[i], 56, y + 10, 56),
        text(128, y + 34, names[i], { size: 15, weight: 700 }),
        text(128, y + 56, prices[i], { size: 13, fill: MUTED }),
        text(700, y + 42, `2025.02.${20 - i * 3}`, { size: 14, fill: NAVY }),
        text(860, y + 42, i === 0 ? '배송 완료' : '구매 확정', { size: 14, weight: 600, fill: '#047857' }),
        i === 0
          ? [
              rect(980, y + 20, 120, 36, WHITE, { stroke: '#9ca3af', radius: 6 }),
              text(1040, y + 43, '환불 신청', { size: 14, weight: 700, anchor: 'middle' }),
            ].join('')
          : '',
        rect(1120, y + 20, 120, 36, WHITE, { stroke: LINE, radius: 6 }),
        text(1180, y + 43, '배송 조회', { size: 14, fill: NAVY, anchor: 'middle' }),
      ].join(''),
    ),
  ].join('')
}

function faq(menuLabel: string) {
  const items = ['배송은 얼마나 걸리나요?', '환불은 어떻게 신청하나요?', '교환·반품 기한이 궁금해요', '쿠폰은 어디서 확인하나요?']
  return [
    header(menuLabel),
    breadcrumb('고객센터'),
    text(40, 190, '고객센터', { size: 28, weight: 700 }),
    text(40, 214, '자주 묻는 질문과 문의 방법을 안내합니다', { size: 14, fill: MUTED }),
    ...items.map((q, i) =>
      [
        rect(40, 244 + i * 64, 1360, 52, WHITE, { stroke: LINE, radius: 10 }),
        text(64, 276 + i * 64, `Q. ${q}`, { size: 15, weight: 600 }),
        text(1376, 276 + i * 64, '+', { size: 18, fill: MUTED, anchor: 'end' }),
      ].join(''),
    ),
    rect(40, 520, 1360, 100, BRAND_SOFT, { radius: 10 }),
    text(64, 560, '1:1 문의', { size: 16, weight: 700, fill: BRAND }),
    text(64, 588, '평일 10:00–17:00 · 점심시간 12:00–13:00', { size: 13, fill: MUTED }),
  ].join('')
}

function refund(menuLabel: string) {
  return [
    header(menuLabel),
    breadcrumb('주문 내역 > 환불 신청'),
    text(40, 190, '환불 / 반품 신청', { size: 28, weight: 700 }),
    rect(40, 220, 880, 120, WHITE, { stroke: LINE, radius: 10 }),
    art('linen', 60, 238, 84),
    text(160, 268, '오가닉 린넨 키친웨어', { size: 16, weight: 700 }),
    text(160, 294, '18,000원 · 2025.02.20 배송 완료', { size: 13, fill: MUTED }),
    text(60, 376, '환불 사유', { size: 15, weight: 700 }),
    ...['단순 변심', '상품 불량', '배송 지연'].map((label, i) =>
      [
        circle(70, 412 + i * 40, 8, WHITE, '#9ca3af'),
        text(90, 417 + i * 40, label, { size: 14 }),
      ].join(''),
    ),
    rect(60, 540, 160, 44, BRAND, { radius: 8 }),
    text(140, 568, '환불 신청하기', { size: 15, weight: 700, fill: WHITE, anchor: 'middle' }),
  ].join('')
}

/** 화면별 mock 스크린샷(SVG 문자열). `menuLabel`은 홈 상단 메뉴 라벨(Before `이용정보`, After `주문·환불`) */
export function screenshotSvg(pageKey: PageKey, menuLabel: string): string {
  const body =
    pageKey === 'home'
      ? home(menuLabel)
      : pageKey === 'mypage'
        ? mypage(menuLabel)
        : pageKey === 'orders'
          ? orders(menuLabel)
          : pageKey === 'support'
            ? faq(menuLabel)
            : refund(menuLabel)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${body}</svg>`
}
